// แคชไฟล์ของแอปไว้ใช้ออฟไลน์ — เปลี่ยน VERSION ทุกครั้งที่แก้ไฟล์ในรายการ
const VERSION = 'v2.6.3';
const ASSETS = ['./', './index.html', './css/app.css', './js/rail.js', './js/store.js', './js/sound.js',
  './js/scene.js', './js/ticket.js', './js/map.js', './js/app.js', './css/scene.css', './manifest.json', './icon.svg'];

self.addEventListener('install', (e) => {
  // cache: 'reload' = โหลดจากเซิร์ฟเวอร์จริง ไม่หยิบไฟล์เก่าจากแคชเบราว์เซอร์มาใส่แคชเวอร์ชันใหม่
  e.waitUntil(caches.open(VERSION)
    .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// ไฟล์ของแอป: โหลดจากเครือข่ายก่อน (ได้เวอร์ชันล่าสุดเสมอ) ถ้าออฟไลน์ใช้จากแคช
// ฟอนต์จาก Google: ใช้แคชก่อน เพราะไฟล์ไม่เปลี่ยน
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  // ฟอนต์และไลบรารีแผนที่: ไฟล์ไม่เปลี่ยนตามเวอร์ชัน ใช้แคชก่อนได้
  const isFont = /fonts\.(googleapis|gstatic)\.com$|^unpkg\.com$/.test(url.hostname);
  if (url.origin !== location.origin && !isFont) return;

  // ไฟล์ของแอป: ถามเซิร์ฟเวอร์ทุกครั้ง (no-cache) ไม่ใช้แคช HTTP ของเบราว์เซอร์
  // GitHub Pages ตั้ง max-age=600 ถ้าไม่ทำแบบนี้ ผู้ใช้จะเห็นเวอร์ชันเก่าได้ถึง 10 นาทีหลัง deploy
  // (คำขอแบบ navigate สร้าง Request ใหม่พร้อมตัวเลือกไม่ได้ จึงใช้ URL แทน)
  const fresh = () => isFont ? fetch(e.request) : fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' });
  const fromNetwork = () => fresh().then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
    return res;
  });
  e.respondWith(isFont
    ? caches.match(e.request).then(hit => hit || fromNetwork())
    : fromNetwork().catch(() => caches.match(e.request, { ignoreSearch: true })
        .then(hit => hit || (e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
});
