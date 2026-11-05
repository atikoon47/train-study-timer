/**
 * ระบบลากฉีกใบย้อยของตั๋ว (Ticket Stub Tear Controller)
 * รองรับ Pointer Events ทั้งจอสัมผัส เม้าส์ และสไตลัส พร้อม Fallback Accessible Button
 */

class TicketStubTearer {
  constructor(options = {}) {
    this.stubElement = options.stubElement || null;
    this.ticketElement = options.ticketElement || null;
    this.onTearComplete = options.onTearComplete || (() => {});
    
    this.isDragging = false;
    this.startX = 0;
    this.startY = 0;
    this.currentDeltaX = 0;
    this.currentDeltaY = 0;
    this.stubWidth = 100;
    this.thresholdRatio = 0.58; // ประมาณ 60%
    this.hasVibratedMidway = false;
    this.isTorn = false;

    this.checkReducedMotion();
  }

  checkReducedMotion() {
    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  attach(stubElement, ticketElement, onTearCallback) {
    this.stubElement = stubElement;
    this.ticketElement = ticketElement;
    this.onTearComplete = onTearCallback;
    this.isTorn = false;

    if (!this.stubElement) return;

    // ล้าง transform และคลาสเก่า
    this.resetStubStyle();

    // ผูก Pointer Events
    this.stubElement.onpointerdown = this.handlePointerDown.bind(this);
    this.stubElement.onpointermove = this.handlePointerMove.bind(this);
    this.stubElement.onpointerup = this.handlePointerUp.bind(this);
    this.stubElement.onpointercancel = this.handlePointerCancel.bind(this);

    // ป้องกันการลากรูปหรือข้อความของเบราว์เซอร์
    this.stubElement.ondragstart = (e) => e.preventDefault();
  }

  resetStubStyle() {
    if (!this.stubElement) return;
    this.stubElement.style.transform = '';
    this.stubElement.style.opacity = '1';
    this.stubElement.style.transition = '';
    this.stubElement.classList.remove('torn-flying', 'snapping-back', 'tear-ready');
    if (this.ticketElement) {
      this.ticketElement.classList.remove('is-torn');
    }
  }

  handlePointerDown(e) {
    if (this.isTorn) return;
    this.isDragging = true;
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.currentDeltaX = 0;
    this.currentDeltaY = 0;
    this.stubWidth = this.stubElement.offsetWidth || 100;
    this.hasVibratedMidway = false;

    this.stubElement.style.transition = 'none';
    this.stubElement.classList.remove('snapping-back');

    try {
      this.stubElement.setPointerCapture(e.pointerId);
    } catch (err) {
      // ละเว้นกรณีเบราว์เซอร์ไม่รองรับ pointer capture
    }

    // เตรียมเสียง audio context
    if (typeof soundEffects !== 'undefined') {
      soundEffects.init();
    }
  }

  handlePointerMove(e) {
    if (!this.isDragging || this.isTorn) return;

    const deltaX = e.clientX - this.startX;
    const deltaY = e.clientY - this.startY;

    // อนุญาตให้ลากไปทางขวาเป็นหลัก (และลากเฉียงลงได้เล็กน้อย)
    // หรือถ้า layout เป็นแนวตั้ง ให้รับทั้ง deltaX และ deltaY
    const effectiveDrag = Math.max(0, deltaX) + Math.max(0, deltaY * 0.5);
    this.currentDeltaX = effectiveDrag;

    const ratio = effectiveDrag / this.stubWidth;

    // คำนวณองศาเอียงตามแรงดึง
    const rotation = Math.min(14, ratio * 15);
    const translateY = effectiveDrag * 0.2;

    this.stubElement.style.transform = `translate3d(${effectiveDrag}px, ${translateY}px, 0) rotate(${rotation}deg)`;

    // Feedback เมื่อดึงใกล้ถึงจุดฉีกขาด
    if (ratio >= this.thresholdRatio) {
      this.stubElement.classList.add('tear-ready');
      if (!this.hasVibratedMidway) {
        if (typeof soundEffects !== 'undefined') {
          soundEffects.vibrate(20);
        }
        this.hasVibratedMidway = true;
      }
    } else {
      this.stubElement.classList.remove('tear-ready');
      this.hasVibratedMidway = false;
    }
  }

  handlePointerUp(e) {
    if (!this.isDragging || this.isTorn) return;
    this.isDragging = false;

    try {
      this.stubElement.releasePointerCapture(e.pointerId);
    } catch (err) {}

    const ratio = this.currentDeltaX / (this.stubWidth || 100);

    if (ratio >= this.thresholdRatio) {
      // ฉีกขาดสำเร็จ!
      this.executeTear();
    } else {
      // ดึงไม่ถึง threshold -> เด้งกลับ (Snap back)
      this.snapBack();
    }
  }

  handlePointerCancel(e) {
    if (this.isDragging) {
      this.isDragging = false;
      this.snapBack();
    }
  }

  snapBack() {
    if (!this.stubElement) return;
    this.stubElement.classList.remove('tear-ready');
    this.stubElement.classList.add('snapping-back');
    this.stubElement.style.transition = 'transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    this.stubElement.style.transform = 'translate3d(0, 0, 0) rotate(0deg)';
  }

  // เรียกใช้เมื่อฉีกขาด (ทั้งจากการลาก หรือกดปุ่มทางเลือก)
  executeTear() {
    if (this.isTorn) return;
    this.isTorn = true;

    // เล่นเสียงและสั่น
    if (typeof soundEffects !== 'undefined') {
      soundEffects.playTear();
      soundEffects.vibrate([40, 20, 60]);
    }

    if (this.ticketElement) {
      this.ticketElement.classList.add('is-torn');
    }

    if (this.prefersReducedMotion) {
      // กรณีปิดแอนิเมชัน ไม่ต้องเล่นอนิเมชันปลิว
      if (this.stubElement) {
        this.stubElement.style.display = 'none';
      }
      if (typeof this.onTearComplete === 'function') {
        this.onTearComplete();
      }
      return;
    }

    // แอนิเมชันใบย้อยปลิวออก
    if (this.stubElement) {
      this.stubElement.classList.remove('tear-ready');
      this.stubElement.classList.add('torn-flying');
      this.stubElement.style.transition = 'transform 0.55s ease-in, opacity 0.45s ease-in';
      this.stubElement.style.transform = `translate3d(${this.stubWidth * 1.6 + 80}px, 90px, 0) rotate(32deg)`;
      this.stubElement.style.opacity = '0';
    }

    // รอให้แอนิเมชันเล่นจบเล็กน้อยแล้วเข้าสู่โหมดจับเวลา
    setTimeout(() => {
      if (typeof this.onTearComplete === 'function') {
        this.onTearComplete();
      }
    }, 450);
  }
}
