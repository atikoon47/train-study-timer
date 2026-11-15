/**
 * ฉากรถไฟวิ่ง (มุมมองด้านข้าง) — ฉากหลังหลายชั้นเลื่อนด้วยความเร็วต่างกัน
 * ฉากเปลี่ยนตามภูมิประเทศของช่วงทาง และป้ายสถานีวิ่งผ่านตรงเวลาที่รถผ่านสถานีนั้นจริง
 *
 * ตำแหน่งทุกอย่างคำนวณจากเวลาที่ผ่านไป (ไม่ได้สะสมทีละเฟรม) รีเฟรชหน้ากลางทางก็ต่อได้ตรงจุด
 */
const Scene = (() => {
  const TILE = { clouds: 1600, far: 1200, mid: 900, lights: 900, near: 1260 };
  const H = { clouds: 150, far: 170, mid: 120, lights: 120, near: 130 };
  const PARALLAX = { clouds: 0.015, far: 0.08, mid: 0.3, lights: 0.3, near: 1 };
  const DRIFT = { clouds: 5 }; // px/วินาที เมฆลอยเองแม้รถจอด
  const BASE_PX = 240; // px/วินาที ของชั้นหน้าสุด เมื่อเป็นขบวนเร็วที่สุด
  const ACCEL = 5, BRAKE = 7; // วินาที ออกตัว / เบรกเข้าสถานี

  // ---------- ตัวช่วยวาด SVG ----------
  function rng(seed) {
    return () => {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // เส้นสันเขาที่ต่อกันได้ไร้รอยต่อ (ผลรวม sine ที่คาบหารความกว้างลงตัว)
  function ridge(w, h, base, amps, seed, sharp = false) {
    const r = rng(seed);
    const waves = amps.map((a, i) => ({ a, k: i + 1 + (i > 1 ? i : 0), p: r() * Math.PI * 2 }));
    let d = `M0 ${h}`;
    for (let x = 0; x <= w; x += 8) {
      let y = 0;
      waves.forEach(v => {
        const s = Math.sin((x / w) * Math.PI * 2 * v.k + v.p);
        y += v.a * (sharp ? 1 - Math.abs(s) * 2 : s);
      });
      d += ` L${x} ${(base - y).toFixed(1)}`;
    }
    return `${d} L${w} ${h} Z`;
  }

  // สีหม่น "อบ" ลงในภาพครั้งเดียวตอนสร้าง (ไม่ใช้ CSS filter บนชั้นที่เลื่อนทุกเฟรม ซึ่งทำให้กระตุก)
  const svgDoc = (w, h, defs, body) =>
    `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'><defs>${defs}</defs>${body}</svg>`)}")`;
  const svg = (w, h, body, { sat = 1 } = {}) => sat < 1
    ? svgDoc(w, h, `<filter id='m'><feColorMatrix type='saturate' values='${sat}'/></filter>`, `<g filter='url(#m)'>${body}</g>`)
    : svgDoc(w, h, '', body);

  // ต้นตาล (ภาคกลาง)
  const sugarPalm = (x, base, h, c) =>
    `<path d='M${x} ${base} L${x + 1} ${base - h}' stroke='${c}' stroke-width='3'/>` +
    Array.from({ length: 9 }, (_, i) => {
      const a = (i / 9) * Math.PI * 2;
      return `<path d='M${x + 1} ${base - h} l${(Math.cos(a) * 15).toFixed(1)} ${(Math.sin(a) * 11 - 3).toFixed(1)}' stroke='${c}' stroke-width='3' stroke-linecap='round'/>`;
    }).join('') + `<circle cx='${x + 1}' cy='${base - h}' r='7' fill='${c}'/>`;

  // มะพร้าว (ชายทะเล) ลำต้นโค้ง
  const coconut = (x, base, h, c, lean) =>
    `<path d='M${x} ${base} Q${x + lean * 0.2} ${base - h * 0.6} ${x + lean} ${base - h}' stroke='${c}' stroke-width='4' fill='none'/>` +
    [-150, -110, -70, -30, 10, 30].map(deg => {
      const a = deg * Math.PI / 180;
      const ex = x + lean + Math.cos(a) * 24, ey = base - h + Math.sin(a) * 16 + 10;
      return `<path d='M${x + lean} ${base - h} Q${(x + lean + ex) / 2} ${base - h - 10} ${ex.toFixed(1)} ${ey.toFixed(1)}' stroke='${c}' stroke-width='3.5' fill='none' stroke-linecap='round'/>`;
    }).join('');

  const roundTree = (x, base, s, c) =>
    `<rect x='${x - 1.5}' y='${base - s * 0.7}' width='3' height='${s * 0.7}' fill='${c}'/><circle cx='${x}' cy='${base - s}' r='${s * 0.55}' fill='${c}'/>`;

  // เจดีย์ทรงระฆัง
  const chedi = (x, base, c) =>
    `<path d='M${x - 26} ${base} h52 v-8 h-8 q0 -26 -18 -32 v-6 h-2 l-0 -30 l-0 30 h-2 v6 q-18 6 -18 32 h-8 z' fill='${c}'/>`;

  // ---------- ชุดฉาก ----------
  const SETS = {
    city(seed) {
      const r = rng(seed);
      let far = '', mid = '';
      for (let x = 0; x < TILE.far - 40;) {
        const w = 30 + r() * 50, h = 40 + r() * 110;
        far += `<rect x='${x.toFixed(0)}' y='${H.far - h}' width='${w.toFixed(0)}' height='${h}' fill='#8da0a8'/>`;
        x += w + r() * 14;
      }
      for (let x = 0; x < TILE.mid - 60;) {
        const w = 40 + r() * 30, h = 34 + r() * 26;
        mid += `<rect x='${x.toFixed(0)}' y='${H.mid - h}' width='${w.toFixed(0)}' height='${h}' fill='#5d6f6a'/>` +
          `<rect x='${(x + 6).toFixed(0)}' y='${H.mid - h + 8}' width='${(w - 12).toFixed(0)}' height='5' fill='#4a5a56'/>`;
        x += w + 4 + r() * 30;
      }
      return { far: svg(TILE.far, H.far, far, { sat: 0.5 }), mid: svg(TILE.mid, H.mid, mid, { sat: 0.68 }) };
    },
    plain(seed) {
      const r = rng(seed);
      let far = `<path d='${ridge(TILE.far, H.far, H.far - 22, [5, 3, 2], seed)}' fill='#7f9d84'/>`;
      far += chedi(TILE.far * 0.62, H.far - 20, '#7f9d84');
      let mid = `<rect y='${H.mid - 26}' width='${TILE.mid}' height='26' fill='#8fb35a'/>` +
        `<rect y='${H.mid - 26}' width='${TILE.mid}' height='3' fill='#a9c76c'/>` +
        `<rect y='${H.mid - 13}' width='${TILE.mid}' height='2' fill='#7b9c4a'/>`;
      for (let i = 0; i < 6; i++) {
        const x = 40 + r() * (TILE.mid - 80);
        mid += sugarPalm(x, H.mid - 22, 60 + r() * 30, '#3f5a36');
      }
      return { far: svg(TILE.far, H.far, far, { sat: 0.5 }), mid: svg(TILE.mid, H.mid, mid, { sat: 0.68 }) };
    },
    hills(seed) {
      const r = rng(seed);
      const far = `<path d='${ridge(TILE.far, H.far, H.far - 60, [22, 12, 6], seed)}' fill='#86a091'/>`;
      let mid = `<path d='${ridge(TILE.mid, H.mid, H.mid - 24, [8, 5], seed + 1)}' fill='#55804f'/>`;
      for (let i = 0; i < 14; i++) mid += roundTree(20 + r() * (TILE.mid - 40), H.mid - 16, 16 + r() * 14, '#3e6a3c');
      return { far: svg(TILE.far, H.far, far, { sat: 0.5 }), mid: svg(TILE.mid, H.mid, mid, { sat: 0.68 }) };
    },
    mountain(seed) {
      const r = rng(seed);
      const far = `<path d='${ridge(TILE.far, H.far, H.far - 90, [30, 22, 12, 6], seed, true)}' fill='#8095a6'/>` +
        `<path d='${ridge(TILE.far, H.far, H.far - 45, [18, 10, 6], seed + 7)}' fill='#6d8a83'/>`;
      let mid = `<path d='${ridge(TILE.mid, H.mid, H.mid - 40, [14, 8, 4], seed + 2)}' fill='#3f6b45'/>`;
      for (let i = 0; i < 26; i++) {
        const x = 10 + r() * (TILE.mid - 20), h = 30 + r() * 30;
        mid += `<path d='M${x} ${H.mid} L${x + 2} ${H.mid - h}' stroke='#2f5636' stroke-width='3'/>` +
          `<path d='M${x + 2} ${H.mid - h} q-14 6 -16 18 M${x + 2} ${H.mid - h} q14 6 16 18' stroke='#2f5636' stroke-width='2.5' fill='none'/>`;
      }
      return { far: svg(TILE.far, H.far, far, { sat: 0.5 }), mid: svg(TILE.mid, H.mid, mid, { sat: 0.68 }) };
    },
    coast(seed) {
      const r = rng(seed);
      let far = `<rect y='${H.far - 40}' width='${TILE.far}' height='40' fill='#5f93a8'/>` +
        `<rect y='${H.far - 40}' width='${TILE.far}' height='2' fill='#8fb9c8'/>`;
      [[0.2, 34], [0.27, 22], [0.71, 46]].forEach(([p, h]) => {
        const x = TILE.far * p;
        far += `<path d='M${x} ${H.far - 38} q4 -${h} 18 -${h} q14 0 16 ${h} z' fill='#6f8f88'/>`;
      });
      let mid = `<rect y='${H.mid - 22}' width='${TILE.mid}' height='22' fill='#d9c99a'/>`;
      for (let i = 0; i < 6; i++) {
        mid += coconut(40 + r() * (TILE.mid - 80), H.mid - 14, 60 + r() * 30, '#3d5a35', (r() - 0.5) * 30);
      }
      return { far: svg(TILE.far, H.far, far, { sat: 0.5 }), mid: svg(TILE.mid, H.mid, mid, { sat: 0.68 }) };
    },
    isan(seed) {
      const r = rng(seed);
      // อีสาน: ทุ่งกว้างสีฟางข้าว ต้นตาลห่างๆ บ้านใต้ถุนสูง
      const far = `<path d='${ridge(TILE.far, H.far, H.far - 14, [3, 2], seed)}' fill='#a3ab7c'/>`;
      let mid = `<rect y='${H.mid - 24}' width='${TILE.mid}' height='24' fill='#c3b46a'/>` +
        `<rect y='${H.mid - 24}' width='${TILE.mid}' height='3' fill='#d5c77f'/>` +
        `<rect y='${H.mid - 11}' width='${TILE.mid}' height='2' fill='#a8994f'/>`;
      for (let i = 0; i < 3; i++) mid += sugarPalm(80 + r() * (TILE.mid - 160), H.mid - 20, 70 + r() * 25, '#4a5a34');
      const hx = TILE.mid * 0.62, hb = H.mid - 20;
      mid += `<path d='M${hx - 6} ${hb} v-22 M${hx + 34} ${hb} v-22 M${hx + 14} ${hb} v-22' stroke='#5b4632' stroke-width='3'/>` +
        `<rect x='${hx - 8}' y='${hb - 40}' width='44' height='18' fill='#7a5a3c'/>` +
        `<path d='M${hx - 16} ${hb - 38} L${hx + 14} ${hb - 62} L${hx + 44} ${hb - 38} Z' fill='#5e4330'/>`;
      return { far: svg(TILE.far, H.far, far, { sat: 0.5 }), mid: svg(TILE.mid, H.mid, mid, { sat: 0.68 }) };
    },
    palm(seed) {
      const r = rng(seed);
      // ภาคใต้: เขาหินปูนผาตั้งชัน โผล่จากที่ราบ
      let far = `<path d='${ridge(TILE.far, H.far, H.far - 28, [6, 3], seed)}' fill='#86a294'/>`;
      [[0.08, 120, 60], [0.16, 80, 40], [0.45, 140, 70], [0.55, 96, 44], [0.8, 110, 56]].forEach(([p, h, w]) => {
        const x = TILE.far * p, b = H.far - 20;
        far += `<path d='M${x} ${b} C${x + 2} ${b - h * 0.7} ${x + w * 0.15} ${b - h} ${x + w * 0.45} ${b - h} C${x + w * 0.8} ${b - h} ${x + w * 0.9} ${b - h * 0.6} ${x + w} ${b} Z' fill='#6f8e80'/>` +
          `<path d='M${x + w * 0.3} ${b - h * 0.85} q4 ${h * 0.3} 0 ${h * 0.6}' stroke='#61806f' stroke-width='3' fill='none'/>`;
      });
      let mid = '';
      // สวนยาง/ปาล์มเรียงแถว
      for (let x = 14; x < TILE.mid - 14; x += 36) {
        mid += `<rect x='${x - 2}' y='${H.mid - 40}' width='4' height='40' fill='#3a4f33'/>` +
          `<ellipse cx='${x}' cy='${H.mid - 52}' rx='${16 + r() * 4}' ry='${18 + r() * 5}' fill='#3f6a3a'/>`;
      }
      return { far: svg(TILE.far, H.far, far, { sat: 0.5 }), mid: svg(TILE.mid, H.mid, mid, { sat: 0.68 }) };
    }
  };

  // ชั้นหน้า: หญ้าริมทาง พุ่มไม้ และเสาโทรเลขทุก 420px — ของที่ใกล้ตาเบลอตามแนววิ่ง (motion blur)
  function nearTile() {
    const w = TILE.near, h = H.near, r = rng(5);
    let blur = '';
    for (let i = 0; i < 3; i++) {
      const px = 210 + i * 420;
      blur += `<rect x='${px}' y='6' width='5' height='${h - 12}' fill='#4a3d31'/>` +
        `<rect x='${px - 14}' y='16' width='33' height='4' fill='#4a3d31'/>` +
        `<circle cx='${px - 10}' cy='13' r='2' fill='#c9c4b5'/><circle cx='${px + 15}' cy='13' r='2' fill='#c9c4b5'/>`;
    }
    for (let i = 0; i < 9; i++) { // พุ่มไม้/หญ้าสูงริมทาง
      const x = 40 + r() * (w - 80), z = 10 + r() * 22;
      blur += `<ellipse cx='${x.toFixed(0)}' cy='${h - 12}' rx='${(z * 1.6).toFixed(0)}' ry='${z.toFixed(0)}' fill='${r() > 0.5 ? '#3d5a33' : '#4b6b3c'}'/>`;
    }
    let wires = '';
    for (let i = -1; i < 3; i++) {
      const x0 = 212 + i * 420, x1 = x0 + 420;
      wires += `<path d='M${x0} 12 Q${x0 + 210} 30 ${x1} 12' stroke='#2b2b2b' stroke-width='1' fill='none'/>` +
        `<path d='M${x0} 18 Q${x0 + 210} 36 ${x1} 18' stroke='#2b2b2b' stroke-width='1' fill='none'/>`;
    }
    const ground = `<path d='M0 ${h} V${h - 16} Q${w * 0.1} ${h - 22} ${w * 0.2} ${h - 16} T${w * 0.4} ${h - 16} T${w * 0.6} ${h - 16} T${w * 0.8} ${h - 16} T${w} ${h - 16} V${h} Z' fill='#45633a'/>`;
    return svgDoc(w, h,
      `<filter id='mb' x='-10%' y='-10%' width='120%' height='120%'><feColorMatrix type='saturate' values='.7'/><feGaussianBlur stdDeviation='2.5 0'/></filter>`,
      ground + wires + `<g filter='url(#mb)'>${blur}</g>`);
  }

  // เมฆนุ่มๆ (เบลออบไว้ในภาพ) ลอยช้ากว่าทุกชั้น
  function cloudTile() {
    const r = rng(23);
    let c = '';
    for (let i = 0; i < 5; i++) {
      const x = 150 + i * 300 + r() * 80, y = 40 + r() * 60, z = 0.7 + r() * 0.8;
      for (let j = 0; j < 5; j++) {
        c += `<ellipse cx='${(x + (j - 2) * 34 * z + r() * 10).toFixed(0)}' cy='${(y - (j % 2) * 14 * z).toFixed(0)}' rx='${(40 * z).toFixed(0)}' ry='${(18 * z).toFixed(0)}' fill='#fff' fill-opacity='.55'/>`;
      }
    }
    return svgDoc(TILE.clouds, H.clouds,
      `<filter id='b' x='-20%' y='-50%' width='140%' height='200%'><feGaussianBlur stdDeviation='9'/></filter>`,
      `<g filter='url(#b)'>${c}</g>`);
  }

  // ไฟบ้านและไฟทางยามค่ำ (อยู่ระยะเดียวกับชั้นกลาง)
  function lightsTile() {
    const r = rng(41);
    let l = '';
    for (let i = 0; i < 7; i++) {
      const x = 40 + r() * (TILE.lights - 80), y = H.lights - 22 - r() * 30;
      const n = 1 + Math.floor(r() * 3);
      for (let j = 0; j < n; j++) {
        const lx = (x + j * 7).toFixed(0), ly = y.toFixed(0);
        l += `<circle cx='${lx}' cy='${ly}' r='9' fill='url(#g)'/><rect x='${lx - 1.5}' y='${ly - 1}' width='3' height='2.2' fill='#ffd88a'/>`;
      }
    }
    for (let i = 0; i < 3; i++) { // เสาไฟถนน
      const x = (120 + i * 300 + r() * 60).toFixed(0), y = H.lights - 46;
      l += `<circle cx='${x}' cy='${y}' r='22' fill='url(#g)'/><circle cx='${x}' cy='${y}' r='2' fill='#fff1c9'/>`;
    }
    return svgDoc(TILE.lights, H.lights,
      `<radialGradient id='g'><stop offset='0' stop-color='#ffc86e' stop-opacity='.55'/><stop offset='1' stop-color='#ffc86e' stop-opacity='0'/></radialGradient>`, l);
  }

  // ฝูงนกบินผ่าน กระพือปีก
  const BIRDS = `<svg viewBox='0 0 120 50' width='120' height='50' aria-hidden='true'>${
    [[10, 20], [34, 12], [52, 26], [76, 16], [98, 30]].map(([x, y], i) =>
      `<g class='bird' style='animation-delay:-${(i * 0.13).toFixed(2)}s'><path d='M${x - 7} ${y - 3} Q${x - 3} ${y - 4} ${x} ${y} Q${x + 3} ${y - 4} ${x + 7} ${y - 3}' stroke='#2a2f36' stroke-width='1.6' fill='none' stroke-linecap='round'/></g>`).join('')}</svg>`;

  function signHTML(stop) {
    return `<div class="plat"><div class="plat-sign"><b>${esc(stop.name)}</b><small>${esc(stop.en)}</small></div><div class="plat-posts"></div><div class="plat-slab"></div></div>`;
  }

  function timeOfDay(d = new Date()) {
    const h = d.getHours() + d.getMinutes() / 60;
    if (h < 5.5 || h >= 19.5) return 'night';
    if (h < 7.5) return 'dawn';
    if (h >= 17.5) return 'dusk';
    return 'day';
  }

  // ระยะทางเป็นพิกเซลที่ชั้นหน้าวิ่งไปแล้ว ณ เวลา t (มีช่วงออกตัวและเบรก)
  function travelled(t, T, v) {
    if (T <= ACCEL + BRAKE) return v * Math.min(t, T);
    const a = Math.max(0, Math.min(t, T));
    let d = 0;
    d += v * Math.min(a, ACCEL) ** 2 / (2 * ACCEL);
    if (a > ACCEL) d += v * (Math.min(a, T - BRAKE) - ACCEL);
    if (a > T - BRAKE) {
      const b = a - (T - BRAKE);
      d += v * b - v * b * b / (2 * BRAKE);
    }
    return d;
  }

  class TrainScene {
    constructor(el) {
      this.el = el;
      this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      // ใส่ background-image ผ่าน style ทีหลัง (data URI มีเครื่องหมายคำพูด ใส่ใน attribute ตรงๆ ไม่ได้)
      const tiles = {};
      const sets = Object.keys(SETS).map((name, i) => {
        tiles[name] = SETS[name](11 + i * 7);
        return `<div class="set" data-set="${name}"><div class="layer far"></div><div class="haze"></div><div class="layer mid"></div></div>`;
      }).join('');
      el.innerHTML = `
        <div class="sky"></div><div class="stars"></div><div class="sun"></div>
        <div class="layer clouds"></div>
        <div class="birds">${BIRDS}</div>
        <div class="rock">
          ${sets}
          <div class="layer near"></div>
          <div class="track"><div class="sleepers"></div></div>
          <div class="tint"></div>
          <div class="layer lights"></div>
          <div class="plats"></div>
        </div>
        <div class="air"></div>
        <div class="tunnel"><i></i></div>`;
      this.layers = [...el.querySelectorAll('.layer')].map(l => ({
        el: l, kind: Object.keys(TILE).find(k => l.classList.contains(k))
      }));
      el.querySelectorAll('.set').forEach(set => {
        set.querySelector('.far').style.backgroundImage = tiles[set.dataset.set].far;
        set.querySelector('.mid').style.backgroundImage = tiles[set.dataset.set].mid;
      });
      el.querySelector('.layer.near').style.backgroundImage = nearTile();
      el.querySelector('.layer.clouds').style.backgroundImage = cloudTile();
      el.querySelector('.layer.lights').style.backgroundImage = lightsTile();
      this.birds = el.querySelector('.birds');
      this.sleepers = el.querySelector('.sleepers');
      this.platsEl = el.querySelector('.plats');

    }

    // trip: { route, minutes, speed, startedAt }
    load(trip) {
      this.route = trip.route;
      this.T = trip.minutes * 60;
      this.v = (this.reduced ? 0 : BASE_PX * Math.max(0.55, trip.speed / 8));
      this.startedAt = trip.startedAt;
      // เวลาที่รถผ่านแต่ละสถานี (วินาที) → แปลงเป็นระยะพิกเซลบนชั้นหน้า
      this.plats = this.route.stops.map(s => {
        const ts = (s.offset / this.route.km) * this.T;
        const node = document.createElement('div');
        node.className = 'plat-wrap';
        node.innerHTML = signHTML(s);
        this.platsEl.appendChild(node);
        return { node, at: travelled(ts, this.T, this.v || 1) };
      });
      this.platsEl.replaceChildren(...this.plats.map(p => p.node));
      this.el.dataset.tod = timeOfDay();
      this.scene = null;
      this.zoom = parseFloat(getComputedStyle(this.platsEl).zoom) || 1; // หน้าต่างบนมือถือขยายฉากด้วย CSS zoom
    }

    start() {
      this.stop();
      const loop = () => { this.frame(); this.raf = requestAnimationFrame(loop); };
      this.raf = requestAnimationFrame(loop);
      this.queueBirds(6000 + Math.random() * 10000);
    }

    // นกบินผ่านเป็นครั้งคราว (กลางวัน เช้า เย็น)
    queueBirds(ms) {
      clearTimeout(this.birdTimer);
      if (this.reduced) return;
      this.birdTimer = setTimeout(() => {
        if (!this.raf) return;
        if (this.el.dataset.tod !== 'night' && !this.el.classList.contains('in-tunnel')) {
          const b = this.birds;
          b.classList.remove('fly');
          b.style.top = `${8 + Math.random() * 22}%`;
          b.style.setProperty('--w', `${this.el.clientWidth + 160}px`);
          void b.offsetWidth;
          b.classList.add('fly');
        }
        this.queueBirds(25000 + Math.random() * 35000);
      }, ms);
    }

    stop() {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = null;
      clearTimeout(this.birdTimer);
    }

    frame(now = Date.now()) {
      const t = Math.min(this.T, (now - this.startedAt) / 1000);
      const d = travelled(t, this.T, this.v);
      const width = this.el.clientWidth;

      for (const l of this.layers) {
        const shift = (d * PARALLAX[l.kind] + (DRIFT[l.kind] || 0) * (now - this.startedAt) / 1000) % TILE[l.kind];
        l.el.style.transform = `translate3d(${-shift}px,0,0)`;
      }
      this.sleepers.style.transform = `translate3d(${-(d % 28)}px,0,0)`;
      this.el.classList.toggle('moving', this.v > 0 && t > 0.3 && t < this.T - 0.5);

      // ป้ายสถานี: รถจอดแล้วป้ายอยู่กลางหน้าต่างพอดี
      const anchor = width / (2 * this.zoom) - 150;
      for (const p of this.plats) {
        const x = anchor + (p.at - d);
        const visible = x > -320 && x < width / this.zoom + 40;
        p.node.style.display = visible ? '' : 'none';
        if (visible) p.node.style.transform = `translate3d(${x}px,0,0)`;
      }

      // ฉากตามช่วงทาง
      const km = (t / this.T) * this.route.km;
      this.el.classList.toggle('in-tunnel', !!Rail.tunnelAt(this.route, km));
      const scene = Rail.sceneAt(this.route, km);
      if (scene !== this.scene) {
        this.scene = scene;
        this.el.querySelectorAll('.set').forEach(s => s.classList.toggle('on', s.dataset.set === scene));
      }
    }
  }

  return { TrainScene, travelled, timeOfDay };
})();
