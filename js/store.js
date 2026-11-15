/**
 * ที่เก็บข้อมูล (localStorage + สำรองในหน่วยความจำเมื่อใช้ไม่ได้ เช่นโหมดส่วนตัว)
 * วันที่ทั้งหมดใช้ "วันตามเวลาเครื่อง" ไม่ใช่ UTC — อ่านตอนตีหนึ่งก็นับเป็นวันนั้นจริง
 */
(function (root) {
  const KEY = 'train-timer-v2';

  function dayKey(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function addDays(key, n) {
    const [y, m, d] = key.split('-').map(Number);
    return dayKey(new Date(y, m - 1, d + n).getTime());
  }

  // นับวันต่อเนื่องที่มีการอ่าน (นับถึงวันนี้ หรือถึงเมื่อวานถ้าวันนี้ยังไม่ได้อ่าน)
  function streak(trips, now = Date.now()) {
    const days = new Set(trips.filter(t => t.minutesDone > 0).map(t => dayKey(t.endedAt)));
    let day = dayKey(now);
    if (!days.has(day)) day = addDays(day, -1);
    let n = 0;
    while (days.has(day)) { n++; day = addDays(day, -1); }
    return n;
  }

  function minutesOn(trips, key) {
    return trips.filter(t => dayKey(t.endedAt) === key).reduce((sum, t) => sum + t.minutesDone, 0);
  }

  // ตราประทับ: สถานีที่เคยลงจากรถ (อ่านไปแล้วอย่างน้อย 1 นาที) — ครั้งแรกเมื่อไร และลงกี่ครั้ง
  function stamps(trips) {
    const out = {};
    for (const t of [...trips].reverse()) {
      if (!(t.minutesDone > 0)) continue;
      const s = out[t.alightedAt] || (out[t.alightedAt] = { first: t.endedAt, count: 0 });
      s.count++;
    }
    return out;
  }

  // สรุป 7 วันล่าสุด (เก่า → ใหม่) และแยกตามวิชา
  function week(trips, now = Date.now()) {
    const today = dayKey(now);
    const keys = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
    const inWeek = trips.filter(t => keys.includes(dayKey(t.endedAt)));
    const days = keys.map(key => ({ key, minutes: minutesOn(inWeek, key) }));
    const subj = {};
    for (const t of inWeek) {
      const name = t.subject || 'ไม่ได้ระบุวิชา';
      subj[name] = (subj[name] || 0) + t.minutesDone;
    }
    const subjects = Object.entries(subj).filter(([, m]) => m > 0)
      .map(([name, minutes]) => ({ name, minutes })).sort((a, b) => b.minutes - a.minutes);
    return { days, subjects, total: days.reduce((a, d) => a + d.minutes, 0) };
  }

  function defaults() {
    return { v: 2, here: 'kta', subject: '', trips: [], active: null, rest: null, sound: true };
  }

  class Store {
    constructor(backend) {
      this.backend = backend || null;
      this.memory = null;
      this.state = this.load();
    }

    load() {
      try {
        const raw = this.backend && this.backend.getItem(KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.v === 2) return { ...defaults(), ...parsed };
        }
      } catch (e) { /* ข้อมูลเสียหรืออ่านไม่ได้ เริ่มใหม่ */ }
      return defaults();
    }

    save() {
      try {
        if (this.backend) this.backend.setItem(KEY, JSON.stringify(this.state));
      } catch (e) {
        this.backend = null; // เก็บไม่ได้แล้ว ใช้ในหน่วยความจำต่อไป
      }
    }

    set(patch) {
      Object.assign(this.state, patch);
      this.save();
    }

    // จบเที่ยว (ถึงปลายทาง หรือลงกลางทาง) — บันทึกประวัติและย้ายตำแหน่งผู้ใช้ไปสถานีที่ลง
    finish(trip, { stationId, minutesDone, km, arrived, endedAt = Date.now() }) {
      const record = {
        id: trip.id, from: trip.from, to: trip.to, alightedAt: stationId,
        subject: trip.subject, trainNo: trip.trainNo, trainType: trip.trainType,
        minutes: trip.minutes, minutesDone, km, arrived, startedAt: trip.startedAt, endedAt
      };
      this.state.trips.unshift(record);
      this.state.here = stationId;
      this.state.active = null;
      this.save();
      return record;
    }

    stats(now = Date.now()) {
      const trips = this.state.trips;
      return {
        today: minutesOn(trips, dayKey(now)),
        totalMinutes: trips.reduce((s, t) => s + t.minutesDone, 0),
        totalKm: Math.round(trips.reduce((s, t) => s + t.km, 0)),
        streak: streak(trips, now),
        visited: new Set(trips.filter(t => t.arrived).map(t => t.to)).size
      };
    }

    reset() {
      this.state = defaults();
      this.save();
    }
  }

  function browserBackend() {
    try {
      const ls = root.localStorage;
      ls.setItem(KEY + '-probe', '1');
      ls.removeItem(KEY + '-probe');
      return ls;
    } catch (e) {
      return null;
    }
  }

  const api = { Store, dayKey, addDays, streak, minutesOn, stamps, week, browserBackend };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TrainStore = api;
})(typeof window !== 'undefined' ? window : globalThis);
