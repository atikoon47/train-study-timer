/**
 * ตัวควบคุมหลัก: วางแผนบนแผนที่ → ออกตั๋ว → ฉีกตั๋ว → เดินทาง (จับเวลา) → ถึงสถานี
 */
const store = new TrainStore.Store(TrainStore.browserBackend());
const $ = (id) => document.getElementById(id);
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const app = {
  dest: null,
  service: null,
  map: null,
  scene: null,
  timer: null,
  wakeLock: null,
  windowView: false,

  init() {
    soundEffects.enabled = store.state.sound !== false;
    this.syncSoundBtn();
    $('input-subject').value = store.state.subject || '';
    this.bind();

    if (RailMap.available) {
      this.map = new RailMap($('map'), { onStation: (id) => this.tapStation(id) });
    } else {
      document.body.classList.add('no-map');
    }

    if (this.map) this.map.showRidden(store.state.trips);

    const active = store.state.active;
    if (active) {
      if (Date.now() >= active.endTime) this.arrive(active, active.endTime);
      else this.ride(active);
    } else if (store.state.rest) {
      this.rest();
    } else {
      this.plan();
    }
  },

  whenMap(fn) {
    if (this.map) this.map.ready.then(fn);
  },

  show(panel) {
    ['plan', 'ride', 'arrive', 'rest'].forEach(p => { $('panel-' + p).hidden = p !== panel; });
    document.body.dataset.screen = panel;
  },

  bind() {
    $('btn-from').onclick = () => this.openStations('here');
    $('btn-to').onclick = () => this.openStations('dest');
    $('btn-swap').onclick = () => this.swap();
    $('btn-clear').onclick = () => this.clearDest();
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.dest && document.body.dataset.screen === 'plan' && !document.querySelector('dialog[open]')) this.clearDest();
    });
    $('station-search').oninput = () => this.renderStationList();
    $('input-subject').oninput = (e) => store.set({ subject: e.target.value.trim() });
    $('btn-issue').onclick = () => this.issueTicket();
    $('btn-tear').onclick = () => this.tearer && this.tearer.tear();
    $('btn-alight').onclick = () => this.askAlight();
    $('btn-alight-confirm').onclick = () => this.alight();
    $('btn-again').onclick = () => { this.dest = null; this.plan(); };
    $('btn-rest').onclick = () => this.startRest(5);
    $('btn-rest-more').onclick = () => this.startRest(5, true);
    $('btn-rest-end').onclick = () => this.endRest();
    $('btn-view').onclick = () => this.toggleWindow();
    $('btn-recenter').onclick = () => { if (this.map) { this.map.setFollow(true); this.map.updateRide(this.kmAt(Date.now()), 'ease'); } };
    $('btn-log').onclick = () => this.openLog();
    $('btn-reset').onclick = (e) => this.reset(e.currentTarget);
    $('btn-sound').onclick = () => {
      soundEffects.enabled = !soundEffects.enabled;
      store.set({ sound: soundEffects.enabled });
      this.syncSoundBtn();
    };

    document.querySelectorAll('dialog').forEach(d => {
      d.addEventListener('click', (e) => {
        if (e.target === d || e.target.closest('[data-close]')) d.close();
      });
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && store.state.rest) this.restTick();
      if (!store.state.active) return;
      if (document.hidden) { this.scene && this.scene.stop(); }
      else { this.tick(); if (this.windowView) this.scene.start(); this.lockScreen(); }
    });
  },

  syncSoundBtn() {
    const b = $('btn-sound');
    b.setAttribute('aria-pressed', String(soundEffects.enabled));
    b.setAttribute('aria-label', soundEffects.enabled ? 'ปิดเสียง' : 'เปิดเสียง');
  },

  // ---------- ป้ายสถานีแบบไทย ----------
  // prev/next: ชื่อสถานีข้างเคียง (ระหว่างเดินทางใช้ลำดับบนเส้นทาง ไม่งั้นใช้ทุกทางที่ต่อกัน)
  signHTML(id, prev, next) {
    const s = Rail.STATIONS[id];
    if (!prev || !next) {
      const nb = Rail.neighbours(id);
      prev = prev || nb.prev; next = next || nb.next;
    }
    const names = (ids) => ids.map(i => esc(Rail.STATIONS[i].name)).join(' / ');
    return `<div class="sign">
      <div class="sign-name">${esc(s.name)}</div>
      <div class="sign-en">${esc(s.en)}</div>
      <div class="sign-nb"><span class="nb-prev">${names(prev)}</span><span class="nb-next">${names(next)}</span></div>
    </div>`;
  },

  // แสดงป้ายช่วง 25 วินาทีก่อนรถถึงสถานี จนถึง 8 วินาทีหลังผ่าน
  updateStationPop(now) {
    const pop = $('station-pop');
    const T = this.trip.endTime - this.trip.startedAt;
    const t = now - this.trip.startedAt;
    const stops = this.route.stops;
    const i = stops.findIndex(s => {
      const ts = (s.offset / this.route.km) * T;
      return t >= ts - 25000 && t <= ts + 8000;
    });
    const show = i >= 0 && !this.windowView;
    if (!show) { if (!pop.hidden) { pop.hidden = true; this.popId = null; } return; }
    const s = stops[i];
    if (this.popId === s.id) return;
    this.popId = s.id;
    const prev = i > 0 ? [stops[i - 1].id] : [];
    const next = i < stops.length - 1 ? [stops[i + 1].id] : [];
    pop.innerHTML = this.signHTML(s.id, prev, next);
    pop.hidden = false;
  },

  // ---------- วางแผน ----------
  plan() {
    this.show('plan');
    this.renderPlan(true);
  },

  currentRoute() {
    return this.dest ? Rail.route(store.state.here, this.dest) : null;
  },

  renderPlan(moveMap) {
    const here = store.state.here;
    const r = this.currentRoute();
    $('from-v').textContent = Rail.STATIONS[here].name;
    $('from-code').textContent = Rail.code(here);
    $('to-v').textContent = r ? Rail.STATIONS[this.dest].name : 'เลือกสถานี';
    $('to-code').textContent = r ? Rail.code(this.dest) : '';
    $('btn-to').classList.toggle('is-unset', !r);
    $('btn-swap').hidden = !r;
    $('pick-hint').hidden = !!r;
    $('pick-hint').textContent = this.map ? 'แตะสถานีบนแผนที่เพื่อเลือกปลายทาง' : 'กดที่ช่องปลายทางเพื่อเลือกสถานี';
    $('trip-plan').hidden = !r;
    if (r) this.renderServices(r);
    this.whenMap(() => {
      this.map.markStations(here, r ? this.dest : null, r);
      if (moveMap) this.map.showRoute(r);
    });
  },

  renderServices(r) {
    const passing = r.stops.length - 2;
    $('route-meta').textContent = `${r.km} กม., ${passing > 0 ? `ผ่าน ${passing} สถานี` : 'ไม่มีสถานีคั่น'}`;
    const list = Rail.services(r);
    if (!this.service || !list.some(s => s.id === this.service)) this.service = list[0].id;
    const now = Date.now();
    $('services').innerHTML = list.map(s => `
      <button type="button" class="svc" role="radio" aria-checked="${s.id === this.service}" data-id="${s.id}">
        <span class="svc-type">${s.type}<small>ขบวน ${s.no}</small></span>
        <span class="svc-time">ถึง ${hhmm(now + s.minutes * 60000)}</span>
        <span class="svc-min">${fmtMinutes(s.minutes)}</span>
      </button>`).join('');
    $('services').querySelectorAll('.svc').forEach(b => {
      b.onclick = () => {
        this.service = b.dataset.id;
        $('services').querySelectorAll('.svc').forEach(x => x.setAttribute('aria-checked', String(x === b)));
      };
    });
    const fastest = list[0].minutes;
    $('long-note').hidden = fastest <= 180;
    $('long-note').textContent = 'ทางไกลมาก ลงกลางทางเมื่ออ่านพอแล้วได้ เที่ยวหน้าจะออกจากสถานีที่ลง';
  },

  tapStation(id) {
    if (store.state.active || document.body.dataset.screen === 'rest') return;
    if (document.body.dataset.screen === 'arrive') this.show('plan');
    if (id === store.state.here) { this.map && this.map.focusStation(id); return; }
    if (id === this.dest) { this.clearDest(); return; } // แตะปลายทางเดิมซ้ำ = ยกเลิก
    this.dest = id;
    this.renderPlan(true);
  },

  clearDest() {
    this.dest = null;
    this.renderPlan(true);
  },

  swap() {
    if (!this.dest) return;
    const here = store.state.here;
    store.set({ here: this.dest });
    this.dest = here;
    this.renderPlan(true);
  },

  // ---------- รายการสถานี ----------
  openStations(mode) {
    this.pickMode = mode;
    $('stations-title').textContent = mode === 'here' ? 'เลือกสถานีต้นทาง' : 'เลือกสถานีปลายทาง';
    $('station-search').value = '';
    this.renderStationList();
    $('dlg-stations').showModal();
  },

  renderStationList() {
    const q = $('station-search').value.trim().toLowerCase();
    const here = store.state.here;
    // กลุ่มแรก: สถานีบนทางร่วม แล้วตามด้วยสถานีเฉพาะของแต่ละสาย
    const groups = [
      { name: 'ทางร่วมหลายสาย', color: SHARED_COLOR, ids: Object.keys(Rail.STATIONS).filter(isShared) },
      ...Rail.LINES.map(l => ({ name: l.name, color: LINE_COLORS[l.id], ids: l.stops.filter(id => !isShared(id)) }))
    ];
    let html = '';
    groups.forEach(line => {
      const items = line.ids.filter(id => {
        if (this.pickMode === 'dest' && id === here) return false;
        const s = Rail.STATIONS[id];
        return !q || s.name.includes(q) || s.en.toLowerCase().includes(q) || id.includes(q);
      });
      if (!items.length) return;
      html += `<h3 style="--c:${line.color}">${line.name}</h3><ul>` + items.map(id => {
        const s = Rail.STATIONS[id];
        let meta = esc(s.province);
        if (this.pickMode === 'dest') {
          const r = Rail.route(here, id);
          meta = `${r.km} กม., อ่านอย่างน้อย ${fmtMinutes(Rail.services(r)[0].minutes)}`;
        }
        const current = (this.pickMode === 'here' ? here : this.dest) === id;
        return `<li><button type="button" data-id="${id}" ${current ? 'aria-current="true"' : ''}>
          <span class="sl-code">${Rail.code(id)}</span><b>${esc(s.name)}</b><span class="sl-meta">${meta}</span></button></li>`;
      }).join('') + '</ul>';
    });
    $('station-list').innerHTML = html || '<p class="empty">ไม่พบสถานีชื่อนี้</p>';
    $('station-list').querySelectorAll('button[data-id]').forEach(b => {
      b.onclick = () => {
        if (this.pickMode === 'here') {
          store.set({ here: b.dataset.id });
          if (this.dest === b.dataset.id) this.dest = null;
        } else {
          this.dest = b.dataset.id;
        }
        $('dlg-stations').close();
        this.renderPlan(true);
      };
    });
  },

  // ---------- ตั๋ว ----------
  issueTicket() {
    const r = this.currentRoute();
    const s = Rail.services(r).find(x => x.id === this.service);
    this.draft = {
      from: r.from, to: r.to, km: r.km,
      trainNo: s.no, trainType: s.type, speed: s.speed, minutes: s.minutes,
      subject: $('input-subject').value.trim(),
      departAt: Date.now(),
      serial: String(Math.floor(Math.random() * 900000) + 100000)
    };
    $('ticket-slot').innerHTML = ticketHTML(this.draft);
    this.tearer = new StubTearer(() => { $('dlg-ticket').close(); this.depart(); });
    this.tearer.attach($('ticket-slot').querySelector('.pass'));
    $('dlg-ticket').showModal();
  },

  // ---------- ออกเดินทาง ----------
  depart() {
    const now = Date.now();
    const trip = { ...this.draft, id: 'trip-' + now, departAt: now, startedAt: now, endTime: now + this.draft.minutes * 60000 };
    store.set({ active: trip, rest: null });
    soundEffects.playWhistle();
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
    this.ride(trip);
  },

  ride(trip) {
    this.show('ride');
    this.trip = trip;
    this.route = Rail.route(trip.from, trip.to);
    $('hud-train').textContent = `ขบวน ${trip.trainNo} ${trip.trainType}`;
    $('hud-from').textContent = Rail.code(trip.from);
    $('hud-to').textContent = Rail.code(trip.to);
    $('hud-subject').textContent = trip.subject ? 'อ่าน ' + trip.subject : `${Rail.STATIONS[trip.from].name} ถึง ${Rail.STATIONS[trip.to].name}`;
    $('hud-ticks').innerHTML = this.route.stops.slice(1, -1)
      .map(s => `<i style="left:${(s.offset / this.route.km) * 100}%"></i>`).join('');

    if (!this.scene) this.scene = new Scene.TrainScene($('scene'));
    this.scene.load({ route: this.route, minutes: trip.minutes, speed: trip.speed, startedAt: trip.startedAt });
    this.setWindow(!this.map); // ไม่มีแผนที่ (ออฟไลน์) ใช้วิวหน้าต่างอย่างเดียว
    $('btn-view').hidden = !this.map;

    this.whenMap(() => {
      this.map.markStations(trip.from, trip.to, this.route);
      this.map.startRide(this.route);
      setTimeout(() => this.map.updateRide(this.kmAt(Date.now()), 'ease'), reduceMotion() ? 0 : 1300);
    });
    this.lastPassedId = Rail.lastPassed(this.route, this.kmAt(Date.now())).id;
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), 250);
    this.tick();
    this.lockScreen();
  },

  setWindow(on) {
    this.windowView = on;
    $('window').hidden = !on;
    document.body.classList.toggle('window-view', on);
    $('btn-view').setAttribute('aria-pressed', String(on));
    $('btn-view').textContent = on ? 'ดูแผนที่' : 'วิวหน้าต่าง';
    if (on) { this.scene.start(); $('station-pop').hidden = true; this.popId = null; }
    else { this.scene.stop(); if (this.map && this.map.riding) this.map.updateRide(this.kmAt(Date.now())); }
  },

  toggleWindow() { this.setWindow(!this.windowView); },

  kmAt(now) {
    const p = Math.min(1, Math.max(0, (now - this.trip.startedAt) / (this.trip.endTime - this.trip.startedAt)));
    return p * this.route.km;
  },

  tick() {
    const trip = store.state.active;
    if (!trip) return;
    const now = Date.now();
    if (now >= trip.endTime) { this.arrive(trip, trip.endTime); return; }

    const left = Math.ceil((trip.endTime - now) / 1000);
    const h = Math.floor(left / 3600), m = Math.floor(left / 60) % 60, s = left % 60;
    const txt = (h ? h + ':' + String(m).padStart(2, '0') : String(m).padStart(2, '0')) + ':' + String(s).padStart(2, '0');
    $('hud-time').textContent = txt;
    document.title = `${txt} ถึง${Rail.STATIONS[trip.to].name}`;

    const km = this.kmAt(now);
    $('hud-bar').style.width = `${(km / this.route.km) * 100}%`;
    const next = Rail.nextStop(this.route, km);
    const remain = Math.max(0, next.offset - km);
    const dist = remain.toFixed(remain < 10 ? 1 : 0);
    $('hud-next').textContent = next.id === trip.to ? `ปลายทาง ${next.name} อีก ${dist} กม.` : `สถานีต่อไป ${next.name} อีก ${dist} กม.`;

    // ซ่อนแผนที่อยู่ (ดูวิวหน้าต่าง) ไม่ต้องวาดแผนที่ ให้เครื่องว่างไว้เล่นวิวให้ลื่น
    if (this.map && this.map.riding && !this.windowView) this.map.updateRide(km);

    this.updateStationPop(now);

    const passed = Rail.lastPassed(this.route, km).id;
    if (passed !== this.lastPassedId) {
      this.lastPassedId = passed;
      soundEffects.playStamp();
    }
  },

  stopRide() {
    clearInterval(this.timer);
    this.timer = null;
    this.scene && this.scene.stop();
    $('window').hidden = true;
    $('station-pop').hidden = true;
    this.popId = null;
    document.body.classList.remove('window-view');
    this.windowView = false;
    if (this.map) this.map.endRide();
    if (this.wakeLock) { this.wakeLock.release().catch(() => {}); this.wakeLock = null; }
    document.title = 'ตั๋วอ่านหนังสือ';
  },

  async lockScreen() {
    try {
      if ('wakeLock' in navigator && !this.wakeLock && !document.hidden) {
        this.wakeLock = await navigator.wakeLock.request('screen');
        this.wakeLock.addEventListener('release', () => { this.wakeLock = null; });
      }
    } catch (e) { /* อุปกรณ์ไม่รองรับ */ }
  },

  askAlight() {
    const trip = store.state.active;
    const now = Date.now();
    const at = Rail.lastPassed(this.route, this.kmAt(now));
    const mins = Math.floor((now - trip.startedAt) / 60000);
    $('alight-body').textContent = at.id === trip.from
      ? `รถยังไม่ถึงสถานีถัดไป คุณจะลงที่สถานี${at.name}ซึ่งเป็นต้นทาง เวลาที่อ่านไปแล้ว ${mins} นาทีจะยังบันทึกไว้`
      : `คุณจะลงที่สถานี${at.name} เวลาที่อ่านไปแล้ว ${mins} นาทีจะบันทึกไว้ และเที่ยวหน้าจะออกจากสถานี${at.name}`;
    $('dlg-alight').showModal();
  },

  alight() {
    $('dlg-alight').close();
    const trip = store.state.active;
    if (!trip) return;
    const now = Date.now();
    const km = this.kmAt(now);
    const at = Rail.lastPassed(this.route, km);
    this.stopRide();
    const rec = store.finish(trip, {
      stationId: at.id, km: Math.round(km * 10) / 10, arrived: false,
      minutesDone: Math.floor((now - trip.startedAt) / 60000), endedAt: now
    });
    this.showArrival(trip, rec, false);
  },

  arrive(trip, at) {
    this.trip = trip;
    this.route = Rail.route(trip.from, trip.to);
    this.stopRide();
    const rec = store.finish(trip, { stationId: trip.to, km: this.route.km, arrived: true, minutesDone: trip.minutes, endedAt: at });
    soundEffects.playStationBell();
    soundEffects.vibrate([80, 60, 80]);
    try {
      if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
        new Notification(`ถึงสถานี${Rail.STATIONS[trip.to].name}แล้ว`, { body: `อ่านครบ ${trip.minutes} นาที`, icon: 'icon.svg' });
      }
    } catch (e) { /* บางเบราว์เซอร์ต้องส่งผ่าน service worker */ }
    this.showArrival(trip, rec, true);
  },

  showArrival(trip, rec, arrived) {
    this.show('arrive');
    this.dest = null;
    const st = Rail.STATIONS[rec.alightedAt];
    $('arrive-lead').textContent = arrived ? 'ถึงสถานีปลายทางแล้ว' : 'ลงจากรถที่สถานี';
    $('arrive-sign').innerHTML = this.signHTML(rec.alightedAt);
    $('arrive-ticket').innerHTML = ticketHTML(trip, {
      torn: true,
      stamp: arrived ? { text: 'ถึงแล้ว', sub: thaiDate(rec.endedAt) } : { text: 'ลงที่' + st.name, sub: thaiDate(rec.endedAt) }
    });
    const stats = store.stats();
    $('arrive-stats').innerHTML = `
      <div><dt>เที่ยวนี้อ่าน</dt><dd>${fmtMinutes(rec.minutesDone)}</dd></div>
      <div><dt>วันนี้รวม</dt><dd>${fmtMinutes(stats.today)}</dd></div>
      <div><dt>อ่านต่อเนื่อง</dt><dd>${stats.streak} วัน</dd></div>`;
    if (!reduceMotion()) setTimeout(() => soundEffects.playStamp(), 380);
    this.whenMap(() => {
      this.map.markStations(rec.alightedAt, null, null);
      this.map.showRoute(null);
      this.map.showRidden(store.state.trips);
      this.map.arriveAt(rec.alightedAt);
    });
  },

  // ---------- พักที่สถานี (ระหว่างรอบอ่าน) ----------
  startRest(minutes, extend = false) {
    const now = Date.now();
    const cur = store.state.rest;
    const base = extend && cur ? Math.max(now, cur.endTime) : now;
    store.set({ rest: { at: store.state.here, endTime: base + minutes * 60000 } });
    this.rest();
  },

  rest() {
    const r = store.state.rest;
    this.show('rest');
    this.dest = null;
    $('rest-sign').innerHTML = this.signHTML(r.at);
    const tips = ['ลุกขึ้นยืดเส้นยืดสาย', 'ดื่มน้ำสักแก้ว', 'มองไกลๆ พักสายตาจากจอ', 'สูดหายใจลึกๆ ช้าๆ', 'เดินเล่นสั้นๆ ให้เลือดหมุนเวียน'];
    $('rest-tip').textContent = tips[Math.floor(Math.random() * tips.length)];
    this.restDone = Date.now() >= r.endTime;
    clearInterval(this.restTimer);
    this.restTimer = setInterval(() => this.restTick(), 250);
    this.restTick();
    this.whenMap(() => {
      this.map.markStations(r.at, null, null);
      this.map.showRoute(null);
      this.map.focusStation(r.at);
    });
  },

  restTick() {
    const r = store.state.rest;
    if (!r) return;
    const left = Math.max(0, Math.ceil((r.endTime - Date.now()) / 1000));
    if (left > 0) {
      const txt = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
      $('rest-time').textContent = txt;
      $('rest-lead').textContent = 'พักที่สถานี';
      document.title = `พัก ${txt}`;
      this.restDone = false;
      return;
    }
    $('rest-time').textContent = '00:00';
    $('rest-lead').textContent = 'หมดเวลาพักแล้ว ได้เวลาขึ้นขบวนต่อไป';
    document.title = 'หมดเวลาพัก';
    if (this.restDone) return;
    this.restDone = true; // แจ้งครั้งเดียว
    soundEffects.playWhistle();
    soundEffects.vibrate([60, 40, 60]);
    try {
      if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
        new Notification('หมดเวลาพักแล้ว', { body: 'ได้เวลาขึ้นขบวนต่อไป', icon: 'icon.svg' });
      }
    } catch (e) { /* ข้ามได้ */ }
  },

  endRest() {
    clearInterval(this.restTimer);
    this.restTimer = null;
    store.set({ rest: null });
    document.title = 'ตั๋วอ่านหนังสือ';
    this.dest = null;
    this.plan();
  },

  // ---------- สมุดเดินทาง ----------
  openLog() {
    const s = store.stats();
    $('log-stats').innerHTML = `
      <div><dt>วันนี้</dt><dd>${fmtMinutes(s.today)}</dd></div>
      <div><dt>อ่านต่อเนื่อง</dt><dd>${s.streak} วัน</dd></div>
      <div><dt>เวลาอ่านทั้งหมด</dt><dd>${fmtMinutes(s.totalMinutes)}</dd></div>
      <div><dt>ระยะทางรวม</dt><dd>${s.totalKm.toLocaleString('th-TH')} กม.</dd></div>`;
    this.renderWeek();
    this.renderStamps();
    const trips = store.state.trips.slice(0, 40);
    $('log-trips').innerHTML = trips.length ? trips.map(t => `
      <li>
        <div class="lt-route"><span class="code">${Rail.code(t.from)}</span> ${esc(Rail.STATIONS[t.from].name)} <span class="dim">ถึง</span> <span class="code">${Rail.code(t.alightedAt)}</span> ${esc(Rail.STATIONS[t.alightedAt].name)}</div>
        <div class="lt-meta">${new Date(t.endedAt).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}${t.subject ? ', ' + esc(t.subject) : ''}</div>
        <div class="lt-min ${t.arrived ? '' : 'partial'}">${fmtMinutes(t.minutesDone)}${t.arrived ? '' : `<small>ลงก่อนถึง${esc(Rail.STATIONS[t.to].name)}</small>`}</div>
      </li>`).join('') : '<li class="empty">ยังไม่มีการเดินทาง เลือกปลายทางบนแผนที่เพื่อเริ่มเที่ยวแรก</li>';
    const btn = $('btn-reset');
    btn.hidden = !store.state.trips.length;
    btn.textContent = 'ลบประวัติทั้งหมด';
    btn.dataset.armed = '';
    $('dlg-log').showModal();
  },

  renderWeek() {
    const w = TrainStore.week(store.state.trips);
    const max = Math.max(30, ...w.days.map(d => d.minutes));
    const todayKey = TrainStore.dayKey(Date.now());
    $('wk-total').textContent = w.total ? `รวม ${fmtMinutes(w.total)}` : '';
    $('wk-chart').setAttribute('role', 'img');
    $('wk-chart').setAttribute('aria-label', '7 วันล่าสุด ' + w.days.map(d => `${dayLabel(d.key, 'long')} ${fmtMinutes(d.minutes)}`).join(', '));
    $('wk-chart').innerHTML = w.days.map(d => `
      <div class="wk-day${d.key === todayKey ? ' today' : ''}" title="${dayLabel(d.key, 'long')}: ${fmtMinutes(d.minutes)}">
        <span class="wk-v">${d.minutes ? (d.minutes >= 60 ? (d.minutes / 60).toFixed(1).replace('.0', '') + 'ช' : d.minutes) : ''}</span>
        <div class="wk-track"><div class="wk-bar" style="height:${d.minutes ? Math.max(4, (d.minutes / max) * 100) : 0}%"></div></div>
        <span class="wk-d">${dayLabel(d.key, 'narrow')}</span>
      </div>`).join('');
    const top = w.subjects[0] ? w.subjects[0].minutes : 1;
    $('wk-subjects').innerHTML = w.subjects.map(s => `
      <li><span class="ws-name">${esc(s.name)}</span><span class="ws-bar"><i style="width:${(s.minutes / top) * 100}%"></i></span><span class="ws-min">${fmtMinutes(s.minutes)}</span></li>`).join('')
      || '<li class="empty">ยังไม่มีการอ่านในสัปดาห์นี้</li>';
  },

  renderStamps() {
    const got = TrainStore.stamps(store.state.trips);
    const order = [];
    Rail.LINES.forEach(l => l.stops.forEach(id => { if (!order.includes(id)) order.push(id); }));
    $('stamp-count').textContent = `${Object.keys(got).length}/${order.length}`;
    $('stamp-book').innerHTML = order.map((id, i) => {
      const s = Rail.STATIONS[id], g = got[id];
      const tilt = ((i * 37) % 17) - 8; // เอียงไม่เท่ากันเหมือนประทับด้วยมือ
      return g
        ? `<div class="stamp got" style="--c:${stationColor(id)};--tilt:${tilt}deg" title="${esc(s.name)}: ลง ${g.count} ครั้ง ครั้งแรก ${thaiDate(g.first)}">
            <b>${Rail.code(id)}</b><span>${esc(s.name)}</span><small>${thaiDate(g.first)}</small>${g.count > 1 ? `<em>×${g.count}</em>` : ''}</div>`
        : `<div class="stamp" title="${esc(s.name)}: ยังไม่เคยลง"><b>${Rail.code(id)}</b><span>${esc(s.name)}</span></div>`;
    }).join('');
  },

  reset(btn) {
    if (!btn.dataset.armed) {
      btn.dataset.armed = '1';
      btn.textContent = 'กดอีกครั้งเพื่อลบ (ย้อนกลับไม่ได้)';
      return;
    }
    store.reset();
    if (this.map) this.map.showRidden([]);
    $('dlg-log').close();
    this.dest = null;
    this.plan();
  }
};

function dayLabel(key, style) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('th-TH', style === 'long' ? { weekday: 'long', day: 'numeric', month: 'short' } : { weekday: 'narrow' });
}

function fmtMinutes(m) {
  if (m < 60) return `${m} นาที`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} ชม. ${r} นาที` : `${h} ชม.`;
}

app.init();
