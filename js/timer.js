/**
 * ตัวควบคุมเวลาอิง Timestamp (Date.now() Based Timer Controller)
 * คำนวณเวลาคงเหลือจริงจาก endTime เสมอ เพื่อให้แม่นยำแม้สลับแท็บหรือรีเฟรชหน้าจอ
 */

class TrainTimer {
  constructor() {
    this.timerId = null;
    this.wakeLockSentinel = null;
    this.currentTrip = null;

    this.onTick = null;
    this.onComplete = null;
    this.onCancel = null;

    this.setupVisibilityListener();
  }

  // ดักจับการสลับแท็บ (Tab Visibility Change)
  setupVisibilityListener() {
    document.addEventListener('visibilitychange', () => {
      if (!this.currentTrip) return;

      if (document.visibilityState === 'visible') {
        // เมื่อผู้ใช้สลับกลับมาที่แท็บ: ตรวจสอบเวลาทันที
        this.checkStatusImmediate();
        // ขอ Wake Lock ซ้ำหากแท็บกลับมาแสดง
        this.requestWakeLock();
      }
    });
  }

  // ขอสิทธิ์ Web Notification ในจังหวะที่ผู้ใช้มี Interaction
  static async requestNotificationPermission() {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'default') {
          return await Notification.requestPermission();
        }
        return Notification.permission;
      }
    } catch (e) {
      console.warn('Notification permission error:', e);
    }
    return 'denied';
  }

  // ส่งการแจ้งเตือนเมื่อถึงสถานี
  static sendArrivalNotification(subject, stationName) {
    try {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('🚂 ถึงสถานีปลายทางแล้ว!', {
          body: `ขบวนรถอ่านหนังสือวิชา "${subject}" เดินทางถึงสถานี${stationName || 'ปลายทาง'} เรียบร้อยแล้ว ยินดีด้วยครับ!`,
          icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🚂</text></svg>'
        });
      }
    } catch (e) {
      console.warn('Send notification error:', e);
    }
  }

  // เปิดใช้งาน Screen Wake Lock (ป้องกันจอดับขณะอ่านหนังสือ)
  async requestWakeLock() {
    try {
      if ('wakeLock' in navigator && !this.wakeLockSentinel) {
        this.wakeLockSentinel = await navigator.wakeLock.request('screen');
        this.wakeLockSentinel.addEventListener('release', () => {
          this.wakeLockSentinel = null;
        });
      }
    } catch (e) {
      // อุปกรณ์บางรุ่นหรือแท็บเบื้องหลังอาจปฏิเสธ ปล่อยผ่านอย่างปลอดภัย
      this.wakeLockSentinel = null;
    }
  }

  // ปล่อย Screen Wake Lock
  releaseWakeLock() {
    if (this.wakeLockSentinel) {
      try {
        this.wakeLockSentinel.release();
      } catch (e) {}
      this.wakeLockSentinel = null;
    }
  }

  // เริ่มต้นเที่ยวอ่านหนังสือใหม่
  start(tripData) {
    this.stopInterval();

    const now = Date.now();
    const durationMs = tripData.durationMin * 60 * 1000;
    const endTime = tripData.endTime || (now + durationMs);

    this.currentTrip = {
      ...tripData,
      startedAt: tripData.startedAt || now,
      endTime: endTime,
      status: 'running'
    };

    // บันทึกลง Storage ทันที
    storage.setCurrentTrip(this.currentTrip);

    // เปิด Wake Lock
    this.requestWakeLock();

    // เล่นเสียงหวูดรถไฟออกตัว
    if (typeof soundEffects !== 'undefined') {
      soundEffects.playWhistle();
    }

    // เริ่ม Loop ตรวจสอบเวลา
    this.runLoop();

    // วาดเฟรมแรกทันที
    this.tick();
  }

  // ฟื้นฟูเที่ยวที่กำลังวิ่งอยู่จาก LocalStorage (เมื่อรีเฟรชหน้าหรือเปิดเบราว์เซอร์ใหม่)
  resume(savedTrip) {
    if (!savedTrip || !savedTrip.endTime) return false;

    this.currentTrip = savedTrip;
    const now = Date.now();

    if (now >= savedTrip.endTime) {
      // เวลาล่วงเลยไปแล้ว -> สำเร็จทันที!
      this.triggerComplete();
      return true;
    }

    // ยังมีเวลาเหลือ -> วิ่งต่อ
    this.requestWakeLock();
    this.runLoop();
    this.tick();
    return true;
  }

  runLoop() {
    this.stopInterval();
    // อัปเดตทุก 250ms เพื่อความลื่นไหลและประหยัดแบตเตอรี่
    this.timerId = setInterval(() => {
      this.tick();
    }, 250);
  }

  stopInterval() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  // ตรวจสอบสถานะทันที (เช่น เมื่อกลับมาจากสลับแท็บ)
  checkStatusImmediate() {
    if (!this.currentTrip) return;
    this.tick();
  }

  tick() {
    if (!this.currentTrip) return;

    const now = Date.now();
    const totalDurationMs = this.currentTrip.durationMin * 60 * 1000;
    const remainingMs = Math.max(0, this.currentTrip.endTime - now);
    const elapsedMs = Math.max(0, now - this.currentTrip.startedAt);
    const progressRatio = Math.min(1, Math.max(0, elapsedMs / totalDurationMs));

    const isFinished = remainingMs <= 0;

    const timeInfo = {
      remainingMs,
      progressRatio,
      formattedTime: this.formatTime(remainingMs),
      isFinished,
      trip: this.currentTrip
    };

    if (typeof this.onTick === 'function') {
      this.onTick(timeInfo);
    }

    if (isFinished) {
      this.triggerComplete();
    }
  }

  // เมื่ออ่านครบเวลา
  triggerComplete() {
    this.stopInterval();
    this.releaseWakeLock();

    const trip = this.currentTrip;
    this.currentTrip = null;

    if (!trip) return;

    // เล่นเสียงระฆังสถานี
    if (typeof soundEffects !== 'undefined') {
      soundEffects.playStationBell();
      soundEffects.vibrate([100, 50, 150]);
    }

    // ส่ง Web Notification
    TrainTimer.sendArrivalNotification(
      trip.subject,
      trip.ticketMeta ? trip.ticketMeta.toStationName : ''
    );

    // บันทึกความสำเร็จลง Storage
    const result = storage.completeTrip(trip);

    if (typeof this.onComplete === 'function') {
      this.onComplete({
        trip,
        result
      });
    }
  }

  // เมื่อผู้ใช้กดยกเลิกเที่ยว
  cancel() {
    this.stopInterval();
    this.releaseWakeLock();

    const trip = this.currentTrip;
    this.currentTrip = null;

    if (trip) {
      storage.cancelTrip(trip);
    }

    if (typeof this.onCancel === 'function') {
      this.onCancel(trip);
    }
  }

  // จัดรูปแบบเวลา MM:SS หรือ HH:MM:SS
  formatTime(ms) {
    const totalSeconds = Math.ceil(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (n) => String(n).padStart(2, '0');

    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  }
}

const trainTimer = new TrainTimer();
