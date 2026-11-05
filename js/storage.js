/**
 * ระบบจัดการสถานะและ LocalStorage พร้อม Fallback
 * ห่อหุ้มด้วย try/catch ทุกจุดเพื่อป้องกันข้อผิดพลาดกรณีเบราว์เซอร์บล็อกหรือพื้นที่เต็ม
 */

const STORAGE_KEY = 'ptms_train_ticket_state_v1';

const DEFAULT_STATE = {
  activeRouteId: 'northern',
  totalKm: 0,
  stamps: [
    // ปลดล็อกสถานีแรกเริ่มต้น (กรุงเทพ) อัตโนมัติ
    { stationId: 'bkk', unlockedAt: new Date().toISOString(), routeId: 'northern' }
  ],
  trips: [],
  currentTrip: null, // { id, subject, durationMin, startedAt, endTime, targetKm, originKm, status: 'running'|'completed'|'cancelled', ticketMeta: {} }
  recentSubjects: ['คณิตศาสตร์', 'ภาษาอังกฤษ', 'วิทยาศาสตร์', 'ประวัติศาสตร์', 'อ่านหนังสือสอบ'],
  streak: {
    current: 0,
    max: 0,
    lastActiveDate: null // 'YYYY-MM-DD'
  },
  settings: {
    darkMode: false,
    soundEnabled: true,
    vibrateEnabled: true,
    kmPerMinute: 0.5,
    autoTearOnMobile: false
  }
};

class StorageManager {
  constructor() {
    this.memoryState = null;
    this.isLocalStorageAvailable = this.checkStorageAvailability();
    this.state = this.loadState();
  }

  checkStorageAvailability() {
    try {
      const testKey = '__train_storage_test__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      console.warn('LocalStorage ไม่สามารถใช้งานได้ ใช้ Memory Fallback แทน', e);
      return false;
    }
  }

  loadState() {
    let loadedState = null;
    if (this.isLocalStorageAvailable) {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          loadedState = JSON.parse(raw);
        }
      } catch (e) {
        console.error('เกิดข้อผิดพลาดในการอ่าน LocalStorage:', e);
      }
    }

    if (!loadedState) {
      loadedState = JSON.parse(JSON.stringify(DEFAULT_STATE));
    } else {
      // Merge กับค่าเริ่มต้นเพื่อป้องกันฟิลด์ใหม่ตกหล่น
      loadedState = {
        ...DEFAULT_STATE,
        ...loadedState,
        settings: { ...DEFAULT_STATE.settings, ...(loadedState.settings || {}) },
        streak: { ...DEFAULT_STATE.streak, ...(loadedState.streak || {}) }
      };
    }

    this.memoryState = loadedState;
    return loadedState;
  }

  saveState() {
    if (this.isLocalStorageAvailable) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch (e) {
        console.error('เกิดข้อผิดพลาดในการบันทึก LocalStorage:', e);
      }
    }
    this.memoryState = this.state;
  }

  getState() {
    return this.state;
  }

  // อัปเดตการตั้งค่า
  updateSettings(newSettings) {
    this.state.settings = { ...this.state.settings, ...newSettings };
    this.saveState();
  }

  // บันทึกเที่ยวที่กำลังวิ่งอยู่
  setCurrentTrip(trip) {
    this.state.currentTrip = trip;
    this.saveState();
  }

  getCurrentTrip() {
    return this.state.currentTrip;
  }

  clearCurrentTrip() {
    this.state.currentTrip = null;
    this.saveState();
  }

  // เพิ่มวิชาล่าสุด
  addRecentSubject(subject) {
    if (!subject || !subject.trim()) return;
    const clean = subject.trim();
    const list = this.state.recentSubjects || [];
    const filtered = list.filter(s => s !== clean);
    filtered.unshift(clean);
    this.state.recentSubjects = filtered.slice(0, 8); // เก็บสูงสุด 8 รายการ
    this.saveState();
  }

  // คำนวณและอัปเดต Streak
  updateStreak(todayStr = null) {
    const today = todayStr || new Date().toISOString().slice(0, 10);
    const streak = this.state.streak || { current: 0, max: 0, lastActiveDate: null };

    if (!streak.lastActiveDate) {
      streak.current = 1;
      streak.max = 1;
      streak.lastActiveDate = today;
    } else if (streak.lastActiveDate === today) {
      // วันเดียวกัน อ่านเพิ่ม ไม่ต้องเพิ่ม streak
    } else {
      const lastDate = new Date(streak.lastActiveDate);
      const currDate = new Date(today);
      const diffTime = currDate.getTime() - lastDate.getTime();
      const diffDays = Math.round(diffTime / (1000 * 3600 * 24));

      if (diffDays === 1) {
        // ติดต่อกันวันถัดไปพอดี
        streak.current += 1;
        if (streak.current > streak.max) {
          streak.max = streak.current;
        }
        streak.lastActiveDate = today;
      } else if (diffDays > 1) {
        // ขาดช่วง รีเซ็ต streak เป็น 1
        streak.current = 1;
        streak.lastActiveDate = today;
      }
    }

    this.state.streak = streak;
    this.saveState();
  }

  // บันทึกเที่ยวที่สำเร็จ
  completeTrip(trip) {
    const today = new Date().toISOString().slice(0, 10);
    const kmGained = trip.km || Math.round(trip.durationMin * (this.state.settings.kmPerMinute || KM_PER_MINUTE));

    const completedRecord = {
      id: trip.id || 'trip_' + Date.now(),
      subject: trip.subject,
      durationMin: trip.durationMin,
      startedAt: trip.startedAt,
      endedAt: Date.now(),
      completed: true,
      km: kmGained,
      routeId: this.state.activeRouteId,
      ticketMeta: trip.ticketMeta || {}
    };

    this.state.trips.unshift(completedRecord);
    this.state.totalKm += kmGained;
    this.state.currentTrip = null;

    this.addRecentSubject(trip.subject);
    this.updateStreak(today);
    this.saveState();

    return { completedRecord, kmGained };
  }

  // บันทึกเที่ยวที่ยกเลิก
  cancelTrip(trip) {
    if (!trip) {
      this.clearCurrentTrip();
      return;
    }

    const cancelledRecord = {
      id: trip.id || 'trip_' + Date.now(),
      subject: trip.subject,
      durationMin: trip.durationMin,
      startedAt: trip.startedAt,
      endedAt: Date.now(),
      completed: false,
      km: 0,
      routeId: this.state.activeRouteId,
      ticketMeta: trip.ticketMeta || {}
    };

    this.state.trips.unshift(cancelledRecord);
    this.state.currentTrip = null;
    this.saveState();

    return cancelledRecord;
  }

  // ปลดล็อกตราประทับสถานี
  unlockStamp(stationId, routeId) {
    const stamps = this.state.stamps || [];
    const existing = stamps.find(s => s.stationId === stationId && s.routeId === routeId);
    if (!existing) {
      stamps.push({
        stationId,
        routeId,
        unlockedAt: new Date().toISOString()
      });
      this.state.stamps = stamps;
      this.saveState();
      return true; // ปลดล็อกใหม่
    }
    return false; // มีอยู่แล้ว
  }

  // ดึงเวลาอ่านวันนี้ (นาที)
  getTodayMinutes() {
    const todayStr = new Date().toISOString().slice(0, 10);
    return (this.state.trips || [])
      .filter(t => t.completed && new Date(t.endedAt).toISOString().slice(0, 10) === todayStr)
      .reduce((sum, t) => sum + (t.durationMin || 0), 0);
  }

  // ดึงเวลาอ่านสัปดาห์นี้ (นาที)
  getWeekMinutes() {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    return (this.state.trips || [])
      .filter(t => t.completed && new Date(t.endedAt) >= sevenDaysAgo)
      .reduce((sum, t) => sum + (t.durationMin || 0), 0);
  }

  // สลับสายรถไฟที่กำลังเดินทาง
  setActiveRoute(routeId) {
    this.state.activeRouteId = routeId;
    this.saveState();
  }

  // รีเซ็ตข้อมูลทั้งหมด
  resetAll() {
    this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    this.saveState();
  }

  // Export ข้อมูลเป็น JSON
  exportDataJSON() {
    return JSON.stringify(this.state, null, 2);
  }

  // Import ข้อมูลจาก JSON
  importDataJSON(jsonStr) {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed && typeof parsed.totalKm === 'number') {
        this.state = {
          ...DEFAULT_STATE,
          ...parsed
        };
        this.saveState();
        return true;
      }
    } catch (e) {
      console.error('ไม่สามารถนำเข้าข้อมูลได้:', e);
    }
    return false;
  }
}

const storage = new StorageManager();
