// รันด้วย: node tests/run.js
const assert = require('assert');
const Rail = require('../js/rail.js');
const { Store, dayKey, streak } = require('../js/store.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.error('  FAIL ' + name + '\n       ' + e.message); process.exitCode = 1; }
}

console.log('rail');
test('เส้นทางบนสายเดียวกัน ระยะ = ผลต่างกิโลเมตร', () => {
  const r = Rail.route('kta', 'aya');
  assert.strictEqual(r.km, 64);
  assert.deepStrictEqual(r.stops.map(s => s.id), ['kta', 'dmk', 'aya']);
});
test('เส้นทางย้อนเข้ากรุงเทพ ระยะสะสมเพิ่มขึ้นเรื่อยๆ', () => {
  const r = Rail.route('aya', 'kta');
  assert.deepStrictEqual(r.stops.map(s => s.offset), [0, 49, 64]);
});
test('ข้ามสายต้องผ่านชุมทาง (หนองคาย → ลพบุรี ผ่านบ้านภาชี)', () => {
  const r = Rail.route('nki', 'lbi');
  const ids = r.stops.map(s => s.id);
  assert.ok(ids.includes('bpc'));
  assert.ok(!ids.includes('kta'), 'ไม่ควรวิ่งเลยชุมทางเข้ากรุงเทพ');
  assert.strictEqual(r.km, (617 - 83) + (126 - 83));
});
test('สายเหนือ → สายใต้ วิ่งผ่านกรุงเทพอภิวัฒน์', () => {
  const r = Rail.route('cmi', 'hdy');
  assert.strictEqual(r.km, 744 + 938);
  assert.ok(r.stops.some(s => s.id === 'kta'));
});
test('ต้นทาง = ปลายทาง ไม่มีเส้นทาง', () => {
  assert.strictEqual(Rail.route('aya', 'aya'), null);
});
test('ขบวนเร็วกว่าใช้เวลาน้อยกว่า และไม่ต่ำกว่าเวลาขั้นต่ำ', () => {
  const s = Rail.services(Rail.route('kta', 'aya'));
  for (let i = 1; i < s.length; i++) assert.ok(s[i].minutes > s[i - 1].minutes);
  const short = Rail.services(Rail.route('kta', 'dmk'));
  assert.ok(short.every(x => x.minutes >= Rail.MIN_MINUTES));
  assert.strictEqual(new Set(short.map(x => x.minutes)).size, short.length);
});
test('เลขขบวน: ออกจากกรุงเทพเลขคี่ เข้ากรุงเทพเลขคู่', () => {
  Rail.services(Rail.route('kta', 'cmi')).forEach(s => assert.strictEqual(s.no % 2, 1));
  Rail.services(Rail.route('cmi', 'kta')).forEach(s => assert.strictEqual(s.no % 2, 0));
});
test('ลงกลางทางได้สถานีล่าสุดที่ผ่านแล้ว', () => {
  const r = Rail.route('kta', 'aya');
  assert.strictEqual(Rail.lastPassed(r, 10).id, 'kta');
  assert.strictEqual(Rail.lastPassed(r, 15).id, 'dmk');
  assert.strictEqual(Rail.nextStop(r, 15).id, 'aya');
});
test('ทุกสถานีในสายมีข้อมูลและพิกัดครบ', () => {
  Rail.LINES.forEach(l => l.stops.forEach(id => {
    assert.ok(Rail.STATIONS[id], id);
    const [lng, lat] = Rail.STATIONS[id].lngLat;
    assert.ok(lng > 97 && lng < 106 && lat > 5 && lat < 21, id + ' อยู่นอกประเทศไทย');
  }));
});
test('ตำแหน่งรถบนแผนที่: ต้นทาง ปลายทาง และกึ่งกลางช่วง', () => {
  const r = Rail.route('kta', 'aya');
  assert.deepStrictEqual(Rail.positionAt(r, 0).lngLat, Rail.STATIONS.kta.lngLat);
  assert.deepStrictEqual(Rail.positionAt(r, r.km).lngLat.map(n => +n.toFixed(6)), Rail.STATIONS.aya.lngLat);
  const mid = Rail.positionAt(r, 15 + 49 / 2).lngLat;
  assert.ok(Math.abs(mid[1] - (13.915 + 14.3565) / 2) < 1e-9);
  const b = Rail.positionAt(r, 30).bearing;
  assert.ok(b < 10 || b > 350, 'อยุธยาอยู่ทางเหนือของดอนเมือง');
});

test('ตัวรถบนแผนที่: ช่วงพิกัดตามรางโค้งผ่านสถานี และต่อเลยต้นทางได้', () => {
  const r = Rail.route('kta', 'aya');
  const dmk = r.stops.find(s => s.id === 'dmk');
  const pts = Rail.slice(r, dmk.offset - 2, dmk.offset + 2);
  assert.strictEqual(pts.length, 3);
  assert.deepStrictEqual(pts[1], Rail.STATIONS.dmk.lngLat);
  const back = Rail.slice(r, -1, 0);
  assert.strictEqual(back.length, 2);
  assert.ok(back[0][1] < Rail.STATIONS.kta.lngLat[1], 'ท้ายขบวนยื่นเลยต้นทางไปทางใต้');
});

test('ลอดอุโมงค์ขุนตานเฉพาะช่วงขุนตาน-ลำพูน ทั้งขาไปและขากลับ', () => {
  const down = Rail.route('lpg', 'cmi');
  const ktn = down.stops.find(s => s.id === 'ktn').offset;
  assert.ok(Rail.tunnelAt(down, ktn + 1.5));
  assert.strictEqual(Rail.tunnelAt(down, ktn - 1), null);
  assert.strictEqual(Rail.tunnelAt(down, ktn + 10), null);
  const up = Rail.route('cmi', 'lpg');
  const ktnUp = up.stops.find(s => s.id === 'ktn').offset;
  assert.ok(Rail.tunnelAt(up, ktnUp - 1.5));
  assert.strictEqual(Rail.tunnelAt(Rail.route('kta', 'aya'), 30), null);
});
test('สายอีสานใช้ฉากอีสาน', () => {
  assert.strictEqual(Rail.STATIONS.kkn.scene, 'isan');
});

console.log('store');
test('dayKey ใช้วันตามเวลาเครื่อง ไม่ใช่ UTC', () => {
  const t = new Date(2026, 10, 14, 0, 30).getTime(); // 00:30 น.
  assert.strictEqual(dayKey(t), '2026-11-14');
});
test('streak นับวันต่อเนื่อง และยังนับถ้าวันนี้ยังไม่ได้อ่าน', () => {
  const at = (d) => new Date(2026, 10, d, 21, 0).getTime();
  const trips = [12, 13, 14].map(d => ({ minutesDone: 20, endedAt: at(d) }));
  assert.strictEqual(streak(trips, at(14)), 3);
  assert.strictEqual(streak(trips, at(15)), 3);
  assert.strictEqual(streak(trips, at(16)), 0);
});
test('จบเที่ยวแล้วตำแหน่งย้ายไปสถานีที่ลง', () => {
  const s = new Store(null);
  s.finish({ id: 't1', from: 'kta', to: 'aya', minutes: 16, subject: 'x', startedAt: 0 },
    { stationId: 'dmk', minutesDone: 4, km: 15, arrived: false });
  assert.strictEqual(s.state.here, 'dmk');
  assert.strictEqual(s.stats().totalKm, 15);
  assert.strictEqual(s.stats().visited, 0);
});
test('localStorage พังก็ยังทำงานต่อได้', () => {
  const broken = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  const s = new Store(broken);
  s.set({ here: 'aya' });
  assert.strictEqual(s.state.here, 'aya');
});

console.log(`\n${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
