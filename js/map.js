/**
 * แผนที่จริง (MapLibre + แผนที่ฟรีจาก OpenFreeMap)
 * วาดเครือข่ายรถไฟ หมุดสถานี เส้นทางที่เลือก และตำแหน่งรถระหว่างเดินทาง
 * ถ้าโหลดไลบรารีไม่ได้ (ออฟไลน์) RailMap.available = false แล้วแอปจะใช้รายการสถานีกับวิวหน้าต่างแทน
 */
const THAILAND = [[97.3, 5.6], [105.7, 20.5]];
const MAJOR = new Set(['kta', 'nsw', 'psl', 'lpg', 'cmi', 'nma', 'kkn', 'udn', 'nki', 'hhn', 'cpn', 'srt', 'hdy']);
const LINE_COLORS = { north: '#5b9bff', northeast: '#f0a83a', south: '#3fc28a' };

// สถานีบนทางร่วม (อยู่หลายสาย เช่น ดอนเมือง อยุธยา บ้านภาชี) ใช้สีกลาง
const SHARED_COLOR = '#c9d1db';
const TICKET_SHARED = '#4b5a70';
const isShared = (id) => Rail.linesOf(id).length > 1;
const stationColor = (id) => isShared(id) ? SHARED_COLOR : LINE_COLORS[Rail.linesOf(id)[0].id];

function lineColorFor(r) {
  // สีของสายที่ปลายทางอยู่ (ถ้าปลายทางคือกรุงเทพ ใช้สายของต้นทาง) ทางร่วมใช้สีกลาง
  const id = Rail.STATIONS[r.to].km === 0 ? r.from : r.to;
  return isShared(id) ? TICKET_SHARED : LINE_COLORS[Rail.linesOf(id)[0].id];
}

// ขบวนรถวาดเป็นเส้นบนแผนที่ตามแนวราง (หัวรถอยู่ที่ตำแหน่งจริง ตัวรถโค้งตามเส้นทาง)
// ความยาวคิดเป็นพิกเซลบนจอ: หัวรถจักร + รถโดยสาร 4 คัน
const RIDE_ZOOM = 10.4;
const TRAIN_PARTS = [['nose', 0, 3], ['loco', 3, 24]];
for (let i = 0, x = 26.5; i < 4; i++, x += 30.5) TRAIN_PARTS.push(['car', x, x + 28]);

class RailMap {
  static get available() { return typeof maplibregl !== 'undefined'; }

  constructor(el, { onStation }) {
    this.el = el;
    this.onStation = onStation;
    this.markers = {};
    this.follow = true;
    this.map = new maplibregl.Map({
      container: el,
      style: 'https://tiles.openfreemap.org/styles/dark',
      bounds: THAILAND,
      fitBoundsOptions: { padding: 20 },
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
      maxPitch: 65
    });
    this.map.touchZoomRotate.disableRotation();
    this.ready = new Promise(res => this.map.on('load', () => { this.setup(); res(); }));
    this.map.on('zoom', () => el.classList.toggle('z-low', this.map.getZoom() < 6.6));
    this.map.on('dragstart', () => { if (this.riding) this.setFollow(false); });
  }

  setup() {
    const m = this.map;
    // ลดความเด่นของถนน ให้รางรถไฟเป็นพระเอก
    m.getStyle().layers.forEach(l => {
      if (/^highway|^road/.test(l.id) && l.type === 'line') m.setPaintProperty(l.id, 'line-opacity', 0.45);
      if (/^railway/.test(l.id) && l.type === 'line') m.setPaintProperty(l.id, 'line-opacity', 0.5);
    });

    const lines = {
      type: 'FeatureCollection',
      features: Rail.LINES.map(l => ({
        // สายเหนือกับอีสานใช้รางร่วมกันถึงบ้านภาชี วาดเยื้องกันให้เห็นเป็นสองเส้นคู่กัน
        type: 'Feature', properties: { color: LINE_COLORS[l.id], offset: { north: -2.5, northeast: 2.5 }[l.id] || 0 },
        geometry: { type: 'LineString', coordinates: l.stops.map(id => Rail.STATIONS[id].lngLat) }
      }))
    };
    m.addSource('network', { type: 'geojson', data: lines });
    m.addLayer({ id: 'network-glow', type: 'line', source: 'network',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': ['get', 'color'], 'line-width': 10, 'line-blur': 8, 'line-opacity': 0.35 } });
    m.addLayer({ id: 'network', type: 'line', source: 'network',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': ['get', 'color'], 'line-offset': ['get', 'offset'], 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 2.5, 10, 4] } });

    const empty = { type: 'FeatureCollection', features: [] };
    m.addSource('route', { type: 'geojson', data: empty, lineMetrics: true });
    m.addLayer({ id: 'route-glow', type: 'line', source: 'route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#fff', 'line-width': 16, 'line-blur': 10, 'line-opacity': 0.35 } });
    m.addLayer({ id: 'route', type: 'line', source: 'route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#fff', 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 4, 10, 7] } });
    m.addSource('done', { type: 'geojson', data: empty });
    m.addLayer({ id: 'done', type: 'line', source: 'done',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#fff', 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 4, 10, 7] } });

    m.addSource('train', { type: 'geojson', data: empty });
    const parts = ['==', ['geometry-type'], 'LineString'];
    m.addLayer({ id: 'train-shadow', type: 'line', source: 'train', filter: parts,
      paint: { 'line-color': '#000', 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 4.2, 9, 14], 'line-blur': 5, 'line-opacity': 0.55, 'line-translate': [0, 3] } });
    m.addLayer({ id: 'train-edge', type: 'line', source: 'train', filter: parts,
      layout: { 'line-cap': 'butt', 'line-join': 'round' },
      paint: { 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 3.8, 9, 12.5], 'line-color': '#141a22' } });
    m.addLayer({ id: 'train-body', type: 'line', source: 'train', filter: parts,
      layout: { 'line-cap': 'butt', 'line-join': 'round' },
      paint: { 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 3.0, 9, 10], 'line-color': ['match', ['get', 'kind'], 'nose', '#f2b632', 'loco', '#1f4c99', '#dfe3e8'] } });
    m.addLayer({ id: 'train-roof', type: 'line', source: 'train', filter: ['==', ['get', 'kind'], 'car'],
      layout: { 'line-cap': 'butt' },
      paint: { 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.9, 9, 3], 'line-color': '#9ba4ae' } });
    m.addLayer({ id: 'train-lamp', type: 'circle', source: 'train', filter: ['==', ['geometry-type'], 'Point'],
      paint: { 'circle-radius': 16, 'circle-blur': 1, 'circle-color': '#ffe7a3', 'circle-opacity': 0.45 } });
    // ซูมออกไกลจนตัวรถเล็กมาก: แสดงเป็นจุดตำแหน่งรถแทน
    m.addLayer({ id: 'train-dot', type: 'circle', source: 'train', maxzoom: 8.5, filter: ['==', ['geometry-type'], 'Point'],
      paint: { 'circle-radius': 6, 'circle-color': '#1f4c99', 'circle-stroke-width': 2.5, 'circle-stroke-color': '#fff' } });
    m.on('zoom', () => { if (this.riding && this.km != null) this.drawTrain(this.km); });

    // หมุดสถานี (HTML ใช้ฟอนต์ไทยของหน้าเว็บได้ และกดด้วยคีย์บอร์ดได้)
    Object.keys(Rail.STATIONS).forEach(id => {
      const s = Rail.STATIONS[id];
      const node = document.createElement('button');
      node.type = 'button';
      node.className = 'pin' + (MAJOR.has(id) ? ' major' : '');
      node.style.setProperty('--c', stationColor(id));
      if (isShared(id)) node.classList.add('shared');
      node.setAttribute('aria-label', 'สถานี' + s.name);
      node.innerHTML = `<i></i><span>${esc(s.name)}</span>`;
      node.addEventListener('click', (e) => { e.stopPropagation(); this.onStation(id); });
      const anchor = s.lngLat[0] < 100.4 ? 'right' : 'left';
      node.classList.add('label-' + (anchor === 'right' ? 'left' : 'right'));
      this.markers[id] = new maplibregl.Marker({ element: node, anchor: 'center' }).setLngLat(s.lngLat).addTo(m);
    });
    this.el.classList.toggle('z-low', m.getZoom() < 6.6);
    // ให้เครดิตแผนที่แบบย่อ (MapLibre เปิดกางไว้ตอนแรก)
    try { // ขอบฟ้าจางๆ ตอนเอียงกล้อง (มีใน MapLibre รุ่นใหม่)
      if (m.setSky) m.setSky({ 'sky-color': '#16202e', 'horizon-color': '#2a3a52', 'fog-color': '#0e1116', 'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.7, 'fog-ground-blend': 0.35 });
    } catch (e) { /* ไม่รองรับก็ข้าม */ }
    const attrib = this.el.querySelector('.maplibregl-ctrl-attrib');
    if (attrib) attrib.classList.remove('maplibregl-compact-show');
  }

  padding() {
    const wide = innerWidth >= 760;
    const sheet = document.querySelector('.sheet-panel:not([hidden])');
    const h = sheet ? sheet.getBoundingClientRect().height : 0;
    return wide
      ? { top: 60, bottom: 40, left: 420, right: 60 }
      : { top: 70, bottom: Math.min(h + 20, innerHeight * 0.65), left: 30, right: 30 };
  }

  markStations(here, dest, route) {
    const on = new Set(route ? route.stops.map(s => s.id) : []);
    Object.entries(this.markers).forEach(([id, mk]) => {
      const n = mk.getElement();
      n.classList.toggle('here', id === here);
      n.classList.toggle('dest', id === dest);
      n.classList.toggle('on-route', on.has(id));
      n.classList.toggle('muted', !!route && !on.has(id));
    });
  }

  showRoute(r) {
    const m = this.map;
    const data = r
      ? { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: Rail.routeLine(r) } }
      : { type: 'FeatureCollection', features: [] };
    m.getSource('route').setData(data);
    m.getSource('done').setData({ type: 'FeatureCollection', features: [] });
    const color = r ? lineColorFor(r) : '#fff';
    m.setPaintProperty('route', 'line-color', '#fff');
    m.setPaintProperty('route', 'line-dasharray', [1, 0]);
    m.setPaintProperty('route-glow', 'line-color', color);
    m.setPaintProperty('network', 'line-opacity', r ? 0.3 : 1);
    m.setPaintProperty('network-glow', 'line-opacity', r ? 0 : 0.35);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (r) {
      const b = new maplibregl.LngLatBounds();
      Rail.routeLine(r).forEach(p => b.extend(p));
      m.fitBounds(b, { padding: this.padding(), maxZoom: 9, pitch: 0, bearing: 0, duration: reduce ? 0 : 1200 });
    } else {
      this.overview();
    }
  }

  overview() {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.map.fitBounds(THAILAND, { padding: this.padding(), pitch: 0, bearing: 0, duration: reduce ? 0 : 1000 });
  }

  focusStation(id) {
    this.map.easeTo({ center: Rail.STATIONS[id].lngLat, zoom: Math.max(this.map.getZoom(), 7), duration: 800 });
  }

  // ---------- ระหว่างเดินทาง ----------
  startRide(r) {
    this.riding = r;
    this.follow = true;
    this.el.classList.add('riding');
    this.showRoute(r);
    this.map.setPaintProperty('route', 'line-dasharray', [1.2, 1.4]);
    this.map.setPaintProperty('route', 'line-opacity', 0.55);
    this.map.setPaintProperty('done', 'line-color', lineColorFor(r));
    this.km = 0;
    this.drawTrain(0);
  }

  // วาดขบวนรถให้หัวรถอยู่ที่ กม. km และยาวคงที่บนจอไม่ว่าจะซูมเท่าไร
  drawTrain(km) {
    const r = this.riding;
    const lat = Rail.pointAt(r, km).lngLat[1];
    // ซูมเข้า: รถยาวคงที่บนจอ / ซูมออกเกินระยะตามรถ: รถหดตามแผนที่ (ความยาวจริงบนพื้นคงที่) ไม่ยื่นเลยราง
    const z = Math.max(this.map.getZoom(), RIDE_ZOOM);
    const pxPerKm = 512 * 2 ** z / (40075 * Math.cos(lat * Math.PI / 180));
    const at = (px) => Math.max(0, km - px / pxPerKm); // ท้ายขบวนไม่ยื่นเลยสถานีต้นทาง
    const features = TRAIN_PARTS.filter(([, from, to]) => at(from) > at(to)).map(([kind, from, to]) => ({
      type: 'Feature', properties: { kind },
      geometry: { type: 'LineString', coordinates: Rail.slice(r, at(to), at(from)) }
    }));
    features.push({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: Rail.pointAt(r, km + 6 / pxPerKm).lngLat } });
    this.map.getSource('train').setData({ type: 'FeatureCollection', features });
  }

  // mode: 'jump' ทุกครั้งที่เดินหน้า (ลื่นเพราะเรียกถี่), 'ease' ตอนกลับมาตามรถหลังเลื่อนดูเอง
  updateRide(km, mode = 'jump') {
    const r = this.riding;
    if (!r) return;
    this.km = km;
    this.drawTrain(km);
    const pos = Rail.positionAt(r, km);
    // เส้นที่วิ่งผ่านมาแล้ว
    this.map.getSource('done').setData({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: Rail.slice(r, 0, km) } });

    if (this.follow) {
      // ทิศกล้องมองจากด้านหลังรถไปข้างหน้า (เฉลี่ยช่วง 3 กม.) หักเลี้ยวตรงสถานีจึงนุ่มนวล
      const bearing = Rail.bearing(Rail.pointAt(r, km - 2.5).lngLat, Rail.pointAt(r, km + 0.5).lngLat);
      const cam = { center: pos.lngLat, bearing, pitch: 62, zoom: RIDE_ZOOM, padding: this.ridePadding() };
      if (mode === 'ease' && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        this.easing = true;
        this.map.easeTo({ ...cam, duration: 1200 });
        this.map.once('moveend', () => { this.easing = false; });
      } else if (!this.easing) this.map.jumpTo(cam);
    }
  }

  ridePadding() {
    const hud = document.querySelector('.hud');
    const h = hud ? hud.getBoundingClientRect().height : 260;
    return innerWidth >= 760 ? { top: 0, bottom: 120, left: 420, right: 0 } : { top: 0, bottom: h * 0.9, left: 0, right: 0 };
  }

  setFollow(on) {
    this.follow = on;
    document.body.classList.toggle('free-look', !on);
  }

  endRide() {
    this.riding = null;
    this.el.classList.remove('riding');
    this.map.getSource('train').setData({ type: 'FeatureCollection', features: [] });
    this.map.setPaintProperty('route', 'line-opacity', 1);
    this.setFollow(true);
  }

  arriveAt(id) {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.map.easeTo({ center: Rail.STATIONS[id].lngLat, zoom: 11, pitch: 45, padding: this.padding(), duration: reduce ? 0 : 2200 });
  }

  resize() { this.map.resize(); }
}
