/**
 * ตั๋วโดยสารแบบ pass แนวตั้ง + ลากส่วนล่าง (stub) ลงเพื่อฉีก
 */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hhmm = (ts) => new Date(ts).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false });
const thaiDate = (ts) => new Date(ts).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });

// บาร์โค้ดจากเลขตั๋ว (แค่หน้าตา ไม่ได้อ่านได้จริง)
function barcode(serial) {
  let x = 0, bars = '';
  for (let i = 0; i < 46; i++) {
    const d = Number(serial[i % serial.length]) + i;
    const w = (d % 3) + 1;
    bars += `<rect x="${x}" width="${w}" height="34"/>`;
    x += w + ((d * 7) % 3) + 1;
  }
  return `<svg class="barcode" viewBox="0 0 ${x} 34" preserveAspectRatio="none" aria-hidden="true">${bars}</svg>`;
}

/**
 * t: { from, to, km, trainNo, trainType, minutes, subject, departAt, serial }
 * opts.stamp: { text, sub }  opts.torn: ฉีกส่วนล่างไปแล้ว
 */
function ticketHTML(t, opts = {}) {
  const from = Rail.station(t.from);
  const to = Rail.station(t.to);
  const color = lineColorFor(Rail.route(t.from, t.to));
  const arriveAt = t.departAt + t.minutes * 60000;
  const coach = (Number(t.serial.slice(-2)) % 8) + 1;
  const seat = `${(Number(t.serial.slice(1, 3)) % 24) + 1}${'ABCD'[Number(t.serial[3]) % 4]}`;
  return `
  <article class="pass ${opts.torn ? 'is-torn' : ''}" style="--line:${color};--line-ink:${color === LINE_COLORS.northeast ? '#2a1a00' : '#fff'}" aria-label="ตั๋วจาก${esc(from.name)} ไป${esc(to.name)} ขบวน ${t.trainNo} อ่าน ${t.minutes} นาที">
    <div class="pass-main">
      <header class="pass-head">
        <div><small>ขบวน</small><b>${t.trainNo}</b></div>
        <div class="pass-type">${esc(t.trainType)}</div>
        <div class="pass-date"><small>วันที่</small><b>${thaiDate(t.departAt)}</b></div>
      </header>
      <div class="pass-route">
        <div><span class="pass-code">${Rail.code(t.from)}</span><span class="pass-name">${esc(from.name)}</span></div>
        <div class="pass-rail" aria-hidden="true"><i></i><span>${t.km} กม.</span></div>
        <div class="right"><span class="pass-code">${Rail.code(t.to)}</span><span class="pass-name">${esc(to.name)}</span></div>
      </div>
      <dl class="pass-grid">
        <div><dt>ออก</dt><dd>${hhmm(t.departAt)}</dd></div>
        <div><dt>ถึง</dt><dd>${hhmm(arriveAt)}</dd></div>
        <div><dt>ตู้</dt><dd>${coach}</dd></div>
        <div><dt>ที่นั่ง</dt><dd>${seat}</dd></div>
      </dl>
      <div class="pass-fare">
        <div><small>ค่าโดยสาร</small><b>${t.minutes} นาที</b></div>
        <div class="pass-subject"><small>อ่าน</small><b>${t.subject ? esc(t.subject) : 'ไม่ได้ระบุ'}</b></div>
      </div>
      ${opts.stamp ? `<div class="pass-stamp"><span>${esc(opts.stamp.text)}</span><small>${esc(opts.stamp.sub)}</small></div>` : ''}
    </div>
    ${opts.torn ? '' : `
    <div class="pass-stub" title="ลากลงเพื่อฉีก">
      ${barcode(t.serial)}
      <div class="stub-meta"><span>${esc(t.serial)}</span><span>ฉีกตามรอยปรุ</span></div>
    </div>`}
  </article>`;
}

class StubTearer {
  constructor(onTear) {
    this.onTear = onTear;
    this.torn = false;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  attach(ticketEl) {
    this.ticket = ticketEl;
    this.stub = ticketEl && ticketEl.querySelector('.pass-stub');
    this.torn = false;
    if (!this.stub) return;
    this.stub.addEventListener('pointerdown', (e) => this.down(e));
    this.stub.addEventListener('pointermove', (e) => this.move(e));
    this.stub.addEventListener('pointerup', () => this.up());
    this.stub.addEventListener('pointercancel', () => this.snap());
  }

  down(e) {
    if (this.torn) return;
    this.dragging = true;
    this.y0 = e.clientY;
    this.x0 = e.clientX;
    this.dy = 0;
    this.limit = this.stub.offsetHeight * 1.1;
    this.stub.style.transition = 'none';
    this.stub.setPointerCapture(e.pointerId);
    soundEffects.init();
  }

  move(e) {
    if (!this.dragging) return;
    this.dy = Math.max(0, e.clientY - this.y0);
    const dx = (e.clientX - this.x0) * 0.3;
    const r = this.dy / this.limit;
    this.stub.style.transform = `translate(${dx}px, ${this.dy}px) rotate(${Math.min(8, r * 9) * Math.sign(dx || 1)}deg)`;
    const ready = r >= 1;
    if (ready && !this.stub.classList.contains('ready')) soundEffects.vibrate(15);
    this.stub.classList.toggle('ready', ready);
  }

  up() {
    if (!this.dragging) return;
    this.dragging = false;
    if (this.dy / this.limit >= 1) this.tear();
    else this.snap();
  }

  snap() {
    this.dragging = false;
    if (!this.stub || this.torn) return;
    this.stub.classList.remove('ready');
    this.stub.style.transition = 'transform .35s cubic-bezier(.2,1.4,.4,1)';
    this.stub.style.transform = '';
  }

  tear() {
    if (this.torn || !this.stub) return;
    this.torn = true;
    soundEffects.playTear();
    soundEffects.vibrate([30, 20, 50]);
    this.ticket.classList.add('tearing');
    if (this.reduced) {
      this.stub.style.visibility = 'hidden';
      this.onTear();
      return;
    }
    const from = this.stub.style.transform || 'translate(0,0)';
    this.stub.animate([
      { transform: from, opacity: 1 },
      { transform: 'translate(40px, 260px) rotate(16deg)', opacity: 0 }
    ], { duration: 600, easing: 'cubic-bezier(.4,0,.8,.6)', fill: 'forwards' });
    setTimeout(() => this.onTear(), 560);
  }
}
