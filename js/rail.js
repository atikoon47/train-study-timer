/**
 * ข้อมูลเครือข่ายรถไฟ + การคำนวณเส้นทาง / ขบวน (ไม่มี DOM — ทดสอบด้วย Node ได้)
 *
 * เครือข่ายเป็นต้นไม้ที่มีรากที่สถานีกลางกรุงเทพอภิวัฒน์ แต่ละสถานีจึงมีระยะ (km) จากรากเพียงค่าเดียว
 * ระยะทางเป็นค่าโดยประมาณจากระยะทางจริงของการรถไฟ ปัดเป็นจำนวนเต็ม
 * scene = ภูมิประเทศของช่วงทางที่ "วิ่งเข้าหา" สถานีนั้น ใช้เลือกฉากหลังตอนรถวิ่ง
 */
(function (root) {
  const STATIONS = {
    kta: { name: 'กรุงเทพอภิวัฒน์', en: 'Krung Thep Aphiwat', province: 'กรุงเทพมหานคร', km: 0, scene: 'city' },
    dmk: { name: 'ดอนเมือง', en: 'Don Mueang', province: 'กรุงเทพมหานคร', km: 15, scene: 'city' },
    aya: { name: 'อยุธยา', en: 'Ayutthaya', province: 'พระนครศรีอยุธยา', km: 64, scene: 'plain' },
    bpc: { name: 'ชุมทางบ้านภาชี', en: 'Ban Phachi Jn.', province: 'พระนครศรีอยุธยา', km: 83, scene: 'plain' },
    // สายเหนือ
    lbi: { name: 'ลพบุรี', en: 'Lop Buri', province: 'ลพบุรี', km: 126, scene: 'plain' },
    nsw: { name: 'นครสวรรค์', en: 'Nakhon Sawan', province: 'นครสวรรค์', km: 239, scene: 'plain' },
    pct: { name: 'พิจิตร', en: 'Phichit', province: 'พิจิตร', km: 340, scene: 'plain' },
    psl: { name: 'พิษณุโลก', en: 'Phitsanulok', province: 'พิษณุโลก', km: 382, scene: 'plain' },
    utt: { name: 'อุตรดิตถ์', en: 'Uttaradit', province: 'อุตรดิตถ์', km: 478, scene: 'hills' },
    dch: { name: 'เด่นชัย', en: 'Den Chai', province: 'แพร่', km: 527, scene: 'hills' },
    lpg: { name: 'นครลำปาง', en: 'Nakhon Lampang', province: 'ลำปาง', km: 635, scene: 'mountain' },
    ktn: { name: 'ขุนตาน', en: 'Khun Tan', province: 'ลำพูน', km: 676, scene: 'mountain' },
    lpn: { name: 'ลำพูน', en: 'Lamphun', province: 'ลำพูน', km: 722, scene: 'hills' },
    cmi: { name: 'เชียงใหม่', en: 'Chiang Mai', province: 'เชียงใหม่', km: 744, scene: 'plain' },
    // สายตะวันออกเฉียงเหนือ
    srb: { name: 'สระบุรี', en: 'Saraburi', province: 'สระบุรี', km: 106, scene: 'plain' },
    kkj: { name: 'ชุมทางแก่งคอย', en: 'Kaeng Khoi Jn.', province: 'สระบุรี', km: 118, scene: 'hills' },
    pkc: { name: 'ปากช่อง', en: 'Pak Chong', province: 'นครราชสีมา', km: 173, scene: 'mountain' },
    nma: { name: 'นครราชสีมา', en: 'Nakhon Ratchasima', province: 'นครราชสีมา', km: 257, scene: 'hills' },
    bya: { name: 'ชุมทางบัวใหญ่', en: 'Bua Yai Jn.', province: 'นครราชสีมา', km: 339, scene: 'isan' },
    kkn: { name: 'ขอนแก่น', en: 'Khon Kaen', province: 'ขอนแก่น', km: 443, scene: 'isan' },
    udn: { name: 'อุดรธานี', en: 'Udon Thani', province: 'อุดรธานี', km: 562, scene: 'isan' },
    nki: { name: 'หนองคาย', en: 'Nong Khai', province: 'หนองคาย', km: 617, scene: 'isan' },
    // สายใต้
    npt: { name: 'นครปฐม', en: 'Nakhon Pathom', province: 'นครปฐม', km: 57, scene: 'plain' },
    rbr: { name: 'ราชบุรี', en: 'Ratchaburi', province: 'ราชบุรี', km: 110, scene: 'plain' },
    pbi: { name: 'เพชรบุรี', en: 'Phetchaburi', province: 'เพชรบุรี', km: 160, scene: 'plain' },
    hhn: { name: 'หัวหิน', en: 'Hua Hin', province: 'ประจวบคีรีขันธ์', km: 222, scene: 'coast' },
    pkn: { name: 'ประจวบคีรีขันธ์', en: 'Prachuap Khiri Khan', province: 'ประจวบคีรีขันธ์', km: 311, scene: 'coast' },
    cpn: { name: 'ชุมพร', en: 'Chumphon', province: 'ชุมพร', km: 478, scene: 'coast' },
    srt: { name: 'สุราษฎร์ธานี', en: 'Surat Thani', province: 'สุราษฎร์ธานี', km: 644, scene: 'palm' },
    tsg: { name: 'ชุมทางทุ่งสง', en: 'Thung Song Jn.', province: 'นครศรีธรรมราช', km: 766, scene: 'palm' },
    ptl: { name: 'พัทลุง', en: 'Phatthalung', province: 'พัทลุง', km: 839, scene: 'palm' },
    hdy: { name: 'ชุมทางหาดใหญ่', en: 'Hat Yai Jn.', province: 'สงขลา', km: 938, scene: 'palm' },
    yla: { name: 'ยะลา', en: 'Yala', province: 'ยะลา', km: 1048, scene: 'palm' },
    skl: { name: 'สุไหงโก-ลก', en: 'Sungai Kolok', province: 'นราธิวาส', km: 1152, scene: 'palm' },
    npd: { name: 'ชุมทางหนองปลาดุก', en: 'Nong Pla Duk Jn.', province: 'ราชบุรี', km: 73, scene: 'plain' },
    // สายน้ำตก (แยกจากสายใต้ที่หนองปลาดุก)
    kbi: { name: 'กาญจนบุรี', en: 'Kanchanaburi', province: 'กาญจนบุรี', km: 126, scene: 'plain' },
    rkb: { name: 'สะพานข้ามแม่น้ำแคว', en: 'River Kwai Bridge', province: 'กาญจนบุรี', km: 129, scene: 'plain' },
    tks: { name: 'ถ้ำกระแซ', en: 'Tham Krasae', province: 'กาญจนบุรี', km: 178, scene: 'hills' },
    ntk: { name: 'น้ำตก', en: 'Nam Tok', province: 'กาญจนบุรี', km: 203, scene: 'mountain' },
    // สายตะวันออก
    lkb: { name: 'ลาดกระบัง', en: 'Lat Krabang', province: 'กรุงเทพมหานคร', km: 35, scene: 'city' },
    cco: { name: 'ชุมทางฉะเชิงเทรา', en: 'Chachoengsao Jn.', province: 'ฉะเชิงเทรา', km: 66, scene: 'plain' },
    pcb: { name: 'ปราจีนบุรี', en: 'Prachin Buri', province: 'ปราจีนบุรี', km: 127, scene: 'plain' },
    kbr: { name: 'กบินทร์บุรี', en: 'Kabin Buri', province: 'ปราจีนบุรี', km: 166, scene: 'hills' },
    skw: { name: 'สระแก้ว', en: 'Sa Kaeo', province: 'สระแก้ว', km: 203, scene: 'plain' },
    arn: { name: 'อรัญประเทศ', en: 'Aranyaprathet', province: 'สระแก้ว', km: 260, scene: 'plain' }
  };

  // พิกัดสถานีโดยประมาณ [ลองจิจูด, ละติจูด]
  const COORDS = {
    kta: [100.5400, 13.8045], dmk: [100.6040, 13.9150], aya: [100.5835, 14.3565], bpc: [100.7240, 14.4500],
    lbi: [100.6150, 14.8040], nsw: [100.1583, 15.6928], pct: [100.3480, 16.4400], psl: [100.2650, 16.8150],
    utt: [100.0960, 17.6260], dch: [100.0530, 17.9830], lpg: [99.5040, 18.2770], ktn: [99.2730, 18.4880],
    lpn: [99.0100, 18.5670], cmi: [99.0170, 18.7840],
    srb: [100.9100, 14.5280], kkj: [101.0000, 14.5870], pkc: [101.4170, 14.7080], nma: [102.0880, 14.9760],
    bya: [102.4300, 15.5840], kkn: [102.8240, 16.4320], udn: [102.7990, 17.4100], nki: [102.7370, 17.8580],
    npt: [100.0600, 13.8230], rbr: [99.8150, 13.5410], pbi: [99.9440, 13.1130], hhn: [99.9580, 12.5680],
    pkn: [99.7980, 11.8080], cpn: [99.1730, 10.4980], srt: [99.2290, 9.1180], tsg: [99.6790, 8.1640],
    ptl: [100.0770, 7.6170], hdy: [100.4720, 7.0060], yla: [101.2840, 6.5450], skl: [101.9670, 6.0310],
    npd: [99.9350, 13.8300], kbi: [99.5283, 14.0283], rkb: [99.5040, 14.0410], tks: [99.1590, 14.1230],
    ntk: [99.0640, 14.2240],
    lkb: [100.7490, 13.7270], cco: [101.0600, 13.6900], pcb: [101.3700, 14.0480], kbr: [101.7120, 13.9700],
    skw: [102.0660, 13.8070], arn: [102.5050, 13.6930]
  };
  Object.keys(STATIONS).forEach(id => { STATIONS[id].lngLat = COORDS[id]; });

  // รหัสสถานี 3 ตัวอักษรสำหรับพิมพ์บนตั๋ว
  const code = (id) => id.toUpperCase();

  const LINES = [
    { id: 'north', name: 'สายเหนือ', color: '#1c3d74',
      stops: ['kta', 'dmk', 'aya', 'bpc', 'lbi', 'nsw', 'pct', 'psl', 'utt', 'dch', 'lpg', 'ktn', 'lpn', 'cmi'] },
    { id: 'northeast', name: 'สายตะวันออกเฉียงเหนือ', color: '#8a5a12',
      stops: ['kta', 'dmk', 'aya', 'bpc', 'srb', 'kkj', 'pkc', 'nma', 'bya', 'kkn', 'udn', 'nki'] },
    { id: 'south', name: 'สายใต้', color: '#1f6a4a',
      stops: ['kta', 'npt', 'npd', 'rbr', 'pbi', 'hhn', 'pkn', 'cpn', 'srt', 'tsg', 'ptl', 'hdy', 'yla', 'skl'] },
    { id: 'namtok', name: 'สายน้ำตก', color: '#5b3f8c',
      stops: ['kta', 'npt', 'npd', 'kbi', 'rkb', 'tks', 'ntk'] },
    { id: 'east', name: 'สายตะวันออก', color: '#8c2f55',
      stops: ['kta', 'lkb', 'cco', 'pcb', 'kbr', 'skw', 'arn'] }
  ];

  // ประเภทขบวน: ความเร็ว (กม. ต่อ นาทีของการอ่าน) — ขบวนเร็วกว่า = อ่านสั้นกว่าในระยะทางเดียวกัน
  const SERVICES = [
    { id: 'special', type: 'ด่วนพิเศษ', speed: 8, base: 7 },
    { id: 'express', type: 'ด่วน', speed: 6, base: 51 },
    { id: 'rapid', type: 'เร็ว', speed: 4, base: 105 },
    { id: 'ordinary', type: 'ธรรมดา', speed: 3, base: 201 }
  ];

  const MIN_MINUTES = 5;

  function station(id) {
    const s = STATIONS[id];
    return s ? { id, ...s } : null;
  }

  function linesOf(id) {
    return LINES.filter(l => l.stops.includes(id));
  }

  // เส้นทางจากรากถึงสถานี (สถานีบนทางร่วมอยู่หลายสาย แต่ทางจากรากเหมือนกัน)
  function rootPath(id) {
    const line = linesOf(id)[0];
    if (!line) return null;
    return line.stops.slice(0, line.stops.indexOf(id) + 1);
  }

  /**
   * หาเส้นทางระหว่างสองสถานี
   * คืนค่า { from, to, km, stops: [{ id, name, en, scene, offset }] }
   * offset = ระยะ (กม.) จากต้นทางตามเส้นทางที่วิ่งจริง
   */
  function route(fromId, toId) {
    if (fromId === toId) return null;
    const a = rootPath(fromId);
    const b = rootPath(toId);
    if (!a || !b) return null;

    let j = 0;
    while (j < a.length && j < b.length && a[j] === b[j]) j++;
    const from = STATIONS[fromId];
    const jKm = STATIONS[a[j - 1]].km;
    const stops = [];

    // ขาแรก: วิ่งเข้าหาชุมทาง (ระยะจากราก "ลดลง")
    // ฉากของช่วงทางเก็บไว้ที่สถานีฝั่งไกลจากราก จึงใช้ฉากของสถานีที่เพิ่งออกมา
    const up = a.slice(j - 1).reverse();
    up.forEach((id, i) => {
      const s = STATIONS[id];
      const scene = i === 0 ? s.scene : STATIONS[up[i - 1]].scene;
      stops.push({ id, name: s.name, en: s.en, scene, offset: from.km - s.km });
    });
    // ขาสอง: วิ่งออกจากชุมทาง (ระยะจากราก "เพิ่มขึ้น")
    b.slice(j).forEach(id => {
      const s = STATIONS[id];
      stops.push({ id, name: s.name, en: s.en, scene: s.scene, offset: (from.km - jKm) + (s.km - jKm) });
    });
    const km = stops[stops.length - 1].offset;
    return { from: fromId, to: toId, km, stops };
  }

  // เลขขบวนแบบการรถไฟ: เที่ยวล่อง (ออกจากกรุงเทพ) เลขคี่ เที่ยวขึ้น (เข้ากรุงเทพ) เลขคู่
  function trainNumber(service, r) {
    const outbound = STATIONS[r.to].km > STATIONS[r.from].km;
    let h = 0;
    for (const ch of r.from + r.to) h = (h * 31 + ch.charCodeAt(0)) % 997;
    let no = service.base + (h % 20) * 2;
    if (outbound && no % 2 === 0) no += 1;
    if (!outbound && no % 2 === 1) no += 1;
    return no;
  }

  function minutesFor(km, speed) {
    return Math.max(MIN_MINUTES, Math.round(km / speed));
  }

  // รายการขบวนสำหรับกระดานเวลา (ตัดขบวนที่เวลาซ้ำกันเพราะโดนเวลาขั้นต่ำ)
  function services(r) {
    const seen = new Set();
    return SERVICES.map(s => ({
      id: s.id, type: s.type, speed: s.speed,
      no: trainNumber(s, r),
      minutes: minutesFor(r.km, s.speed)
    })).filter(s => {
      if (seen.has(s.minutes)) return false;
      seen.add(s.minutes);
      return true;
    });
  }

  // สถานีล่าสุดที่ผ่านแล้ว ณ ระยะ offset (ใช้ตอนลงกลางทาง)
  function lastPassed(r, offset) {
    let last = r.stops[0];
    for (const s of r.stops) if (s.offset <= offset + 1e-9) last = s;
    return last;
  }

  function nextStop(r, offset) {
    return r.stops.find(s => s.offset > offset + 1e-9) || r.stops[r.stops.length - 1];
  }

  // ฉากของตำแหน่งปัจจุบัน = ฉากของสถานีถัดไปที่กำลังวิ่งเข้าหา
  function sceneAt(r, offset) {
    return nextStop(r, offset).scene;
  }

  // สถานีข้างเคียงสำหรับป้ายชื่อสถานี (อาจมีหลายทางที่ชุมทาง)
  function neighbours(id) {
    const prev = new Set();
    const next = new Set();
    linesOf(id).forEach(l => {
      const i = l.stops.indexOf(id);
      if (i > 0) prev.add(l.stops[i - 1]);
      if (i < l.stops.length - 1) next.add(l.stops[i + 1]);
    });
    return { prev: [...prev], next: [...next] };
  }

  // ทิศ (องศาจากทิศเหนือ ตามเข็มนาฬิกา) จากจุด a ไป b
  function bearing(a, b) {
    const r = Math.PI / 180;
    const y = Math.sin((b[0] - a[0]) * r) * Math.cos(b[1] * r);
    const x = Math.cos(a[1] * r) * Math.sin(b[1] * r) - Math.sin(a[1] * r) * Math.cos(b[1] * r) * Math.cos((b[0] - a[0]) * r);
    return (Math.atan2(y, x) / r + 360) % 360;
  }

  // ตำแหน่งรถบนแผนที่ ณ ระยะ offset (กม.) จากต้นทาง: { lngLat, bearing }
  function positionAt(r, offset) {
    return pointAt(r, Math.max(0, Math.min(r.km, offset)));
  }

  // จุดบนเส้นทาง ณ กม. ใดๆ (เลยต้นทาง/ปลายทางได้ ต่อแนวเส้นช่วงแรก/ช่วงสุดท้ายออกไป)
  function pointAt(r, km) {
    const st = r.stops;
    let i = 0;
    while (i < st.length - 2 && st[i + 1].offset <= km) i++;
    const a = STATIONS[st[i].id].lngLat, b = STATIONS[st[i + 1].id].lngLat;
    const span = st[i + 1].offset - st[i].offset;
    const f = span > 0 ? (km - st[i].offset) / span : 0;
    return { lngLat: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], bearing: bearing(a, b) };
  }

  // อุโมงค์ (กม. จากกรุงเทพ) — อุโมงค์ขุนตาน ยาวราว 1.36 กม. อยู่เลยสถานีขุนตานไปทางลำพูน
  const TUNNELS = [{ name: 'อุโมงค์ขุนตาน', a: 'ktn', b: 'lpn', fromKm: 677, toKm: 678.4 }];

  // ระยะจากกรุงเทพ ณ ตำแหน่ง offset บนเส้นทาง พร้อมช่วงสถานีที่อยู่
  function segmentAt(r, offset) {
    const st = r.stops;
    let i = 0;
    while (i < st.length - 2 && st[i + 1].offset <= offset) i++;
    const a = st[i], b = st[i + 1];
    const f = (offset - a.offset) / ((b.offset - a.offset) || 1);
    return { a: a.id, b: b.id, rootKm: STATIONS[a.id].km + (STATIONS[b.id].km - STATIONS[a.id].km) * f };
  }

  function tunnelAt(r, offset) {
    const seg = segmentAt(r, offset);
    return TUNNELS.find(t => ((seg.a === t.a && seg.b === t.b) || (seg.a === t.b && seg.b === t.a))
      && seg.rootKm >= t.fromKm && seg.rootKm <= t.toKm) || null;
  }

  const routeLine = (r) => r.stops.map(s => STATIONS[s.id].lngLat);

  // พิกัดตามเส้นทางจาก กม. a ถึง b (รวมจุดสถานีที่อยู่ระหว่างนั้น เพื่อให้โค้งตามราง)
  function slice(r, a, b) {
    const pts = [pointAt(r, a).lngLat];
    for (const s of r.stops) if (s.offset > a && s.offset < b) pts.push(STATIONS[s.id].lngLat);
    pts.push(pointAt(r, b).lngLat);
    return pts;
  }

  const api = { STATIONS, LINES, SERVICES, MIN_MINUTES, station, code, linesOf, route, services, minutesFor, trainNumber, lastPassed, nextStop, sceneAt, neighbours, bearing, positionAt, pointAt, slice, routeLine, segmentAt, tunnelAt };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Rail = api;
})(typeof window !== 'undefined' ? window : globalThis);
