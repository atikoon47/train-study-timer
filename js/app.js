/**
 * ตัวควบคุมหลักของเว็บแอป "ตั๋วอ่านหนังสือ" (Study Train Ticket App Controller)
 */

class TrainApp {
  constructor() {
    this.currentScreen = 'screen-buy-ticket';
    this.activeRoute = null;
    this.selectedDuration = 25; // ค่าเริ่มต้น 25 นาที (Pomodoro)
    this.selectedClassId = 'class3';
    this.ticketTearer = new TicketStubTearer();
    this.randomTrainMeta = null;

    this.init();
  }

  init() {
    this.loadActiveRoute();
    this.applySettings();
    this.setupNavigation();
    this.setupTicketForm();
    this.setupTimerCallbacks();
    this.setupModals();
    this.setupSettingsToggles();
    this.setupDataTools();

    // ตรวจสอบเที่ยวที่ค้างอยู่ (เช่น รีเฟรชหน้า หรือปิดเบราว์เซอร์ไปแล้วกลับมา)
    this.checkPendingTripOnBoot();
  }

  // โหลดข้อมูลสายรถไฟที่เลือก
  loadActiveRoute() {
    const state = storage.getState();
    const route = RAILWAY_ROUTES.find(r => r.id === state.activeRouteId) || RAILWAY_ROUTES[0];
    this.activeRoute = route;

    // อัปเดตข้อความหัวแอป
    const subtitleEl = document.getElementById('header-route-name');
    if (subtitleEl) {
      subtitleEl.textContent = `${route.shortName}: ${route.origin} → ${route.destination}`;
    }
  }

  // ปรับใช้การตั้งค่าเริ่มต้น
  applySettings() {
    const state = storage.getState();
    if (state.settings.darkMode) {
      document.body.classList.add('dark-mode');
      const darkBtn = document.getElementById('btn-toggle-dark');
      if (darkBtn) darkBtn.textContent = '☀️';
    }

    soundEffects.enabled = state.settings.soundEnabled !== false;
    soundEffects.vibrateEnabled = state.settings.vibrateEnabled !== false;
    const soundBtn = document.getElementById('btn-toggle-sound');
    if (soundBtn) {
      soundBtn.textContent = soundEffects.enabled ? '🔊' : '🔇';
    }
  }

  // จัดการการสลับหน้าจอ (Screen Navigation)
  setupNavigation() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const targetScreen = tab.dataset.screen;
        if (targetScreen) {
          this.navigateTo(targetScreen);
        }
      });
    });
  }

  navigateTo(screenId) {
    this.currentScreen = screenId;

    // ซ่อนทุกหน้าจอแล้วแสดงหน้าจอเป้าหมาย
    document.querySelectorAll('.screen').forEach(el => {
      el.classList.remove('active');
    });

    const targetEl = document.getElementById(screenId);
    if (targetEl) {
      targetEl.classList.add('active');
    }

    // อัปเดตสถานะแถบเมนูด้านล่าง
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.screen === screenId);
    });

    // เลื่อนหน้าจอขึ้นบนสุด
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // วาดเนื้อหาเฉพาะหน้าจอ
    if (screenId === 'screen-route') {
      this.renderRouteMap();
    } else if (screenId === 'screen-passport') {
      this.renderPassport();
    } else if (screenId === 'screen-stats') {
      this.renderStats();
    } else if (screenId === 'screen-buy-ticket') {
      this.updateTicketPreview();
    }
  }

  // ตั้งค่าฟอร์มซื้อตั๋ว
  setupTicketForm() {
    const subjectInput = document.getElementById('input-subject');
    const customDurationInput = document.getElementById('input-custom-duration');
    const tearButton = document.getElementById('btn-direct-tear');

    // รายการวิชาที่เคยใช้ (Recent Subject Chips)
    this.renderRecentSubjectChips();

    if (subjectInput) {
      subjectInput.addEventListener('input', () => {
        this.updateTicketPreview();
      });
    }

    // ปุ่มเลือกระยะเวลา (15, 25, 50, 90)
    const durationBtns = document.querySelectorAll('.duration-chip');
    durationBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        durationBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const dur = parseInt(btn.dataset.duration, 10);
        this.selectedDuration = dur;
        if (customDurationInput) customDurationInput.value = '';

        this.updateTicketPreview();
      });
    });

    // กำหนดเวลาระยะเวลาเอง (Custom Duration)
    if (customDurationInput) {
      customDurationInput.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        if (val > 0 && val <= 300) {
          durationBtns.forEach(b => b.classList.remove('active'));
          this.selectedDuration = val;
          this.updateTicketPreview();
        }
      });
    }

    // เลือกระดับชั้นของตั๋ว (Class 1, 2, 3)
    const classCards = document.querySelectorAll('.class-card');
    classCards.forEach(card => {
      card.addEventListener('click', () => {
        classCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this.selectedClassId = card.dataset.classId;
        this.updateTicketPreview();
      });
    });

    // ปุ่มฉีกตั๋วตรง (Accessible Button Fallback)
    if (tearButton) {
      tearButton.addEventListener('click', () => {
        this.ticketTearer.executeTear();
      });
    }

    // สร้างเมตาดาต้าสุ่มสำหรับตั๋วเที่ยวนี้
    this.generateRandomTrainMeta();
    this.updateTicketPreview();
  }

  // สุ่มเลขขบวนรถและที่นั่งเพื่อความสมจริง
  generateRandomTrainMeta() {
    const train = TRAIN_NAMES[Math.floor(Math.random() * TRAIN_NAMES.length)];
    const coachNo = Math.floor(Math.random() * 8) + 1;
    const seatRow = Math.floor(Math.random() * 24) + 1;
    const seatCol = ['A', 'B', 'C', 'D'][Math.floor(Math.random() * 4)];
    const seatNo = `${seatRow}${seatCol}`;
    const serial = `№ ${String(Math.floor(Math.random() * 90000) + 10000)}-${this.activeRoute.code}`;

    this.randomTrainMeta = {
      trainNo: train.no,
      trainType: train.type,
      coachNo,
      seatNo,
      serial
    };
  }

  // วาดรายการวิชาที่เคยใช้
  renderRecentSubjectChips() {
    const container = document.getElementById('recent-subjects-container');
    if (!container) return;

    const subjects = storage.getState().recentSubjects || [];
    container.innerHTML = '';

    subjects.forEach(sub => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip-btn';
      chip.textContent = sub;
      chip.addEventListener('click', () => {
        const subjectInput = document.getElementById('input-subject');
        if (subjectInput) {
          subjectInput.value = sub;
          this.updateTicketPreview();
        }
      });
      container.appendChild(chip);
    });
  }

  // คำนวณและอัปเดต Live Preview ของตั๋ว
  updateTicketPreview() {
    const subjectInput = document.getElementById('input-subject');
    const subject = (subjectInput && subjectInput.value.trim()) || 'การศึกษาค้นคว้าอิสระ';
    const durationMin = this.selectedDuration || 25;
    const state = storage.getState();
    const currentTotalKm = state.totalKm || 0;

    // คำนวณระยะทางของเที่ยวนี้ (กม.)
    const kmGained = Math.round(durationMin * (state.settings.kmPerMinute || KM_PER_MINUTE));
    const targetKm = currentTotalKm + kmGained;

    // ค้นหาสถานีต้นทางและปลายทางบนเส้นทาง
    const stations = this.activeRoute.stations;
    let fromStation = stations[0];
    let toStation = stations[stations.length - 1];

    for (let i = stations.length - 1; i >= 0; i--) {
      if (currentTotalKm >= stations[i].km) {
        fromStation = stations[i];
        break;
      }
    }

    for (let i = 0; i < stations.length; i++) {
      if (stations[i].km >= targetKm) {
        toStation = stations[i];
        break;
      }
    }

    // เวลาออกและเวลาถึง
    const now = new Date();
    const arrTime = new Date(now.getTime() + durationMin * 60 * 1000);
    const formatTime = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

    const deptStr = formatTime(now);
    const arrStr = formatTime(arrTime);

    // ดึงประเภทตั๋ว
    const classObj = TICKET_CLASSES.find(c => c.id === this.selectedClassId) || TICKET_CLASSES[0];

    // อัปเดตข้อมูลบนตั๋ว Live Preview
    const meta = this.randomTrainMeta || {
      trainNo: '9',
      trainType: 'ด่วนพิเศษ CNR',
      coachNo: 2,
      seatNo: '14A',
      serial: '№ 09472-BKK'
    };

    // บันทึกสถานะคำนวณไว้เตรียมเริ่ม
    this.pendingTripData = {
      subject,
      durationMin,
      originKm: currentTotalKm,
      targetKm,
      km: kmGained,
      ticketMeta: {
        fromStationName: fromStation.name,
        fromStationEn: fromStation.nameEn,
        toStationName: toStation.name,
        toStationEn: toStation.nameEn,
        trainNo: meta.trainNo,
        trainType: meta.trainType,
        coachNo: meta.coachNo,
        seatNo: meta.seatNo,
        serial: meta.serial,
        className: classObj.name,
        classBadge: classObj.badge,
        deptStr,
        arrStr
      }
    };

    // อัปเดต DOM ของตั๋ว
    this.renderTicketDOM('preview-ticket', this.pendingTripData, false);

    // ผูกลากฉีกใบย้อย
    const ticketEl = document.getElementById('preview-ticket');
    if (ticketEl) {
      const stubEl = ticketEl.querySelector('.ticket-stub');
      this.ticketTearer.attach(stubEl, ticketEl, () => {
        this.startTrip();
      });
    }

    // อัปเดตแถบประกาศ
    this.updateStationAnnouncement(fromStation.name, toStation.name, meta.trainNo);
  }

  // อัปเดตข้อความประกาศสถานี
  updateStationAnnouncement(fromName, toName, trainNo) {
    const tickerText = document.getElementById('ticker-announcement');
    if (tickerText) {
      tickerText.textContent = `ท่านผู้โดยสารโปรดทราบ ขบวนที่ ${trainNo} เตรียมออกเดินทางจากสถานี${fromName} ไปยังสถานี${toName} ขอให้เตรียมความพร้อม`;
    }
  }

  // วาดโครงสร้าง HTML ของตั๋ว
  renderTicketDOM(containerId, tripData, isTorn = false) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const m = tripData.ticketMeta || {};

    container.innerHTML = `
      <div class="train-ticket ${isTorn ? 'is-torn' : ''}">
        <div class="ticket-main">
          <div class="ticket-header">
            <div class="ticket-logo-group">
              <svg class="ticket-emblem" viewBox="0 0 24 24">
                <path d="M12 2C8 2 4 3 4 7v10c0 2 2 3 4 3l-1.5 1.5v.5h11v-.5L16 20c2 0 4-1 4-3V7c0-4-4-5-8-5zm0 2c3.5 0 6 .8 6 2v2H6V6c0-1.2 2.5-2 6-2zm-6 8h12v4H6v-4zm2 6c-.8 0-1.5-.7-1.5-1.5S7.2 13 8 13s1.5.7 1.5 1.5S8.8 16 8 16zm8 0c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5z"/>
              </svg>
              <span class="ticket-org-name">ตั๋วอ่านหนังสือ รฟท.</span>
            </div>
            <span class="ticket-type-badge">${m.classBadge || 'ชั้น 3'}</span>
          </div>

          <div class="ticket-route">
            <div class="station-point">
              <div class="station-label">ต้นทาง (FROM)</div>
              <div class="station-name">${m.fromStationName || 'กรุงเทพ'}</div>
              <div class="station-en">${m.fromStationEn || 'Bangkok'}</div>
            </div>
            <div class="route-arrow">
              <span class="route-track-icon">🚆</span>
              <span class="route-km-badge">+${tripData.km || 12} กม.</span>
            </div>
            <div class="station-point">
              <div class="station-label">ปลายทาง (TO)</div>
              <div class="station-name">${m.toStationName || 'อยุธยา'}</div>
              <div class="station-en">${m.toStationEn || 'Ayutthaya'}</div>
            </div>
          </div>

          <div class="ticket-details-grid">
            <div class="detail-item detail-subject">
              <span class="detail-label">วิชา / เป้าหมายการอ่าน</span>
              <span class="detail-value">${tripData.subject || 'อ่านหนังสือ'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">ขบวนรถ</span>
              <span class="detail-value">ขบวน ${m.trainNo || '9'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">คันที่ / ที่นั่ง</span>
              <span class="detail-value">คัน ${m.coachNo || '1'} (${m.seatNo || '12A'})</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">ระยะเวลาอ่าน</span>
              <span class="detail-value tabular-nums">${tripData.durationMin || 25} นาที</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">เวลาออก</span>
              <span class="detail-value tabular-nums">${m.deptStr || '--:--'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">เวลาถึง</span>
              <span class="detail-value tabular-nums">${m.arrStr || '--:--'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">เลขที่ตั๋ว</span>
              <span class="detail-value">${m.serial || '№ 00000'}</span>
            </div>
          </div>

          <div id="ticket-stamp-layer" class="stamp-overlay">
            <span>ตรวจตั๋วแล้ว</span>
            <small style="display:block; font-size:0.6rem; letter-spacing:0;">ARRIVED</small>
          </div>
          <div class="punch-hole" style="top: 12px; right: 18px; display: ${isTorn ? 'block' : 'none'};"></div>
        </div>

        <div class="ticket-divider" style="display: ${isTorn ? 'none' : 'block'};"></div>

        <div class="ticket-stub" style="display: ${isTorn ? 'none' : 'flex'};" title="ลากเพื่อฉีกตั๋วออกเดินทาง">
          <div class="stub-header">ใบตรวจตั๋ว</div>
          <div class="stub-train-info">
            <div>ขบวน ${m.trainNo || '9'}</div>
            <div>ที่นั่ง</div>
            <div class="stub-seat">${m.seatNo || '14A'}</div>
          </div>
          <div class="stub-tear-action">
            <span class="stub-arrow-icon">👉</span>
            <span class="stub-tear-text">ฉีกเพื่อเริ่ม</span>
          </div>
          <div class="stub-barcode">
            <span></span><span></span><span></span><span></span><span></span>
            <span></span><span></span><span></span><span></span><span></span>
          </div>
          <div class="stub-serial">${m.serial || ''}</div>
        </div>
      </div>
    `;
  }

  // เริ่มต้นเที่ยวอ่านหนังสือ (เมื่อฉีกตั๋วสำเร็จ)
  async startTrip() {
    // ขอสิทธิ์ Web Notification
    await TrainTimer.requestNotificationPermission();

    const tripData = {
      id: 'trip_' + Date.now(),
      ...this.pendingTripData,
      startedAt: Date.now()
    };

    // สุ่มตั๋วใหม่สำหรับรอบถัดไป
    this.generateRandomTrainMeta();

    // เริ่มระบบจับเวลา
    trainTimer.start(tripData);

    // นำทางสู่หน้าตัวจับเวลา Minimalist
    this.navigateTo('screen-timer');

    // วาดตั๋วแบบฉีกขาดแล้วในหน้าจับเวลา
    this.renderTicketDOM('timer-ticket-container', tripData, true);
  }

  // ตั้งค่า Callback ของ Timer
  setupTimerCallbacks() {
    const countdownEl = document.getElementById('timer-countdown-display');
    const subjectEl = document.getElementById('timer-subject-display');
    const checkpointEl = document.getElementById('timer-checkpoint-display');

    // ทุก Tick
    trainTimer.onTick = (info) => {
      if (countdownEl) {
        countdownEl.textContent = info.formattedTime;
      }
      if (subjectEl) {
        subjectEl.textContent = `วิชา: ${info.trip.subject}`;
      }

      // อัปเดต Mini SVG Track ในหน้าจับเวลา
      this.updateTimerTrackProgress(info.progressRatio, info.trip);

      // อัปเดตข้อความสถานีที่กำลังผ่าน
      if (checkpointEl) {
        const currentKm = info.trip.originKm + (info.progressRatio * (info.trip.km || 0));
        const passedStation = this.findNearestStation(currentKm);
        checkpointEl.textContent = `กำลังผ่าน: บริเวณ${passedStation.name} (กม. ที่ ${Math.round(currentKm)})`;
      }
    };

    // เมื่ออ่านครบเวลา (ถึงสถานี)
    trainTimer.onComplete = (data) => {
      this.handleArrival(data);
    };

    // เมื่อกดยกเลิกเที่ยว
    trainTimer.onCancel = (trip) => {
      this.handleTripCancelled(trip);
    };
  }

  // อัปเดต Mini SVG Track แถบความคืบหน้าของเที่ยวนี้
  updateTimerTrackProgress(progressRatio, trip) {
    const container = document.getElementById('timer-mini-track');
    if (!container) return;

    const width = 500;
    const height = 50;
    const startX = 50;
    const endX = 450;
    const trainX = startX + progressRatio * (endX - startX);

    const m = trip.ticketMeta || {};
    const fromName = m.fromStationName || 'ต้นทาง';
    const toName = m.toStationName || 'ปลายทาง';

    container.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" width="100%" height="100%">
        <!-- รางรถไฟไม้หมอน -->
        <line x1="${startX}" y1="28" x2="${endX}" y2="28" stroke="var(--ticket-border)" stroke-width="6" stroke-linecap="round"/>
        <line x1="${startX}" y1="28" x2="${trainX}" y2="28" stroke="var(--ink-primary)" stroke-width="6" stroke-linecap="round"/>

        <!-- เสา/จุดสถานีต้นทาง -->
        <circle cx="${startX}" cy="28" r="8" fill="var(--ink-primary)"/>
        <circle cx="${startX}" cy="28" r="4" fill="#fff"/>
        <text x="${startX}" y="46" font-family="var(--font-header)" font-size="11" fill="var(--ink-primary)" text-anchor="middle">${fromName}</text>

        <!-- เสา/จุดสถานีปลายทาง -->
        <circle cx="${endX}" cy="28" r="8" fill="var(--stamp-red)"/>
        <circle cx="${endX}" cy="28" r="4" fill="#fff"/>
        <text x="${endX}" y="46" font-family="var(--font-header)" font-size="11" fill="var(--stamp-red)" text-anchor="middle">${toName}</text>

        <!-- หัวรถไฟที่กำลังวิ่ง -->
        <g transform="translate(${trainX - 18}, 8)" class="anim-train-rock">
          <!-- ควันรถไฟ -->
          <circle cx="2" cy="-2" r="3" class="steam-particle"/>
          <circle cx="-5" cy="-8" r="4" class="steam-particle"/>
          <!-- ตัวรถไฟดีเซล -->
          <rect x="0" y="2" width="36" height="18" rx="3" fill="var(--ink-primary)"/>
          <rect x="24" y="5" width="10" height="7" rx="1" fill="#facc15"/>
          <rect x="4" y="6" width="6" height="6" rx="1" fill="#fff" opacity="0.8"/>
          <rect x="13" y="6" width="6" height="6" rx="1" fill="#fff" opacity="0.8"/>
          <!-- กันชนหน้า -->
          <polygon points="36,12 40,20 36,20" fill="var(--stamp-red)"/>
          <!-- ล้อรถไฟ -->
          <circle cx="8" cy="20" r="4" fill="#333" class="anim-wheel"/>
          <circle cx="28" cy="20" r="4" fill="#333" class="anim-wheel"/>
        </g>
      </svg>
    `;
  }

  // จัดการเมื่อถึงสถานี
  handleArrival(data) {
    const { trip, result } = data;
    this.navigateTo('screen-arrival');

    // วาดตั๋วพร้อมประทับตรา "ตรวจตั๋วแล้ว"
    this.renderTicketDOM('arrival-ticket-container', trip, true);
    setTimeout(() => {
      const stampEl = document.querySelector('#arrival-ticket-container .stamp-overlay');
      if (stampEl) {
        stampEl.classList.add('active');
        if (typeof soundEffects !== 'undefined') {
          soundEffects.playStamp();
        }
      }
    }, 200);

    // แสดงสรุปผลเที่ยวนี้
    const kmVal = document.getElementById('arrival-stat-km');
    const timeVal = document.getElementById('arrival-stat-time');
    const currentStationVal = document.getElementById('arrival-stat-station');
    const totalKmVal = document.getElementById('arrival-stat-total-km');

    const totalKm = storage.getState().totalKm;
    const currentStation = this.findNearestStation(totalKm);

    if (kmVal) kmVal.textContent = `+${result.kmGained}`;
    if (timeVal) timeVal.textContent = `${trip.durationMin} นาที`;
    if (currentStationVal) currentStationVal.textContent = currentStation.name;
    if (totalKmVal) totalKmVal.textContent = `${totalKm} กม.`;

    // ตรวจสอบและปลดล็อกตราประทับสถานีที่ข้ามผ่าน
    this.checkAndUnlockStamps(trip.originKm, totalKm);

    // ข้อความยินดีในสถานี
    const msgEl = document.getElementById('arrival-message');
    if (msgEl) {
      msgEl.textContent = `ขอแสดงความยินดี! ท่านได้อ่านวิชา "${trip.subject}" สำเร็จตามเป้าหมาย รถไฟได้นำท่านเข้าสู่บริเวณสถานี${currentStation.name} เรียบร้อยแล้ว`;
    }

    // อัปเดตรายการวิชาล่าสุดในฟอร์ม
    this.renderRecentSubjectChips();
  }

  // ตรวจสอบสถานีที่ข้ามผ่านและปลดล็อกตราประทับ
  checkAndUnlockStamps(fromKm, toKm) {
    const newStampsContainer = document.getElementById('new-stamps-alert-area');
    if (!newStampsContainer) return;
    newStampsContainer.innerHTML = '';

    const routeStations = this.activeRoute.stations;
    const newlyUnlocked = [];

    routeStations.forEach(st => {
      if (toKm >= st.km) {
        const isNew = storage.unlockStamp(st.id, this.activeRoute.id);
        if (isNew) {
          newlyUnlocked.push(st);
        }
      }
    });

    if (newlyUnlocked.length > 0) {
      // มีตราประทับใหม่ปลดล็อก!
      newlyUnlocked.forEach(st => {
        const card = document.createElement('div');
        card.className = 'new-stamp-card';
        card.innerHTML = `
          <div class="stamp-badge-preview">${st.icon || '🎖️'}</div>
          <div style="flex: 1;">
            <strong style="font-size: 1.1rem; display: block;">🎉 ได้รับตราประทับสถานี${st.name}!</strong>
            <span style="font-size: 0.85rem;">บันทึกลงสมุดพาสปอร์ตการรถไฟเรียบร้อย (${st.province} • กม. ${st.km})</span>
          </div>
        `;
        newStampsContainer.appendChild(card);
      });
    }
  }

  // จัดการกรณียกเลิกเที่ยว
  handleTripCancelled(trip) {
    // แสดงเอฟเฟกต์ตั๋วฉีกขาด
    const timerTicket = document.querySelector('#timer-ticket-container .train-ticket');
    if (timerTicket) {
      timerTicket.classList.add('ticket-torn-cancelled');
    }

    setTimeout(() => {
      alert(`ขบวนรถวิชา "${trip.subject}" ถูกยกเลิกเรียบร้อย (เที่ยวนี้ไม่ได้รับระยะทางสะสม)`);
      this.navigateTo('screen-buy-ticket');
    }, 450);
  }

  // วาดผังเส้นทางรถไฟ SVG (Schematic Railway Map)
  renderRouteMap() {
    const container = document.getElementById('route-map-canvas');
    if (!container) return;

    const state = storage.getState();
    const currentKm = Math.min(this.activeRoute.totalKm, state.totalKm);
    const stations = this.activeRoute.stations;

    // คำนวณความสูงตามจำนวนสถานี
    const svgHeight = Math.max(540, stations.length * 85);
    const svgWidth = 520;
    const startY = 50;
    const endY = svgHeight - 60;
    const lineX = 140;

    // หาตำแหน่ง Y ของรถไฟตาม currentKm
    const totalKm = this.activeRoute.totalKm;
    const trainY = startY + (currentKm / totalKm) * (endY - startY);

    let stationsSvg = '';
    stations.forEach(st => {
      const stY = startY + (st.km / totalKm) * (endY - startY);
      const isReached = currentKm >= st.km;
      const isUnlocked = state.stamps.some(s => s.stationId === st.id && s.routeId === this.activeRoute.id);

      stationsSvg += `
        <g class="route-station-node" style="cursor: pointer;" onclick="app.showStationDetail('${st.id}')">
          <!-- วงกลมสถานี -->
          <circle cx="${lineX}" cy="${stY}" r="9" fill="${isReached ? 'var(--ink-primary)' : 'var(--bg-card)'}" stroke="var(--ink-primary)" stroke-width="3"/>
          <circle cx="${lineX}" cy="${stY}" r="4" fill="${isReached ? '#fff' : 'var(--ticket-border)'}"/>

          <!-- ป้ายกิโลเมตร -->
          <rect x="25" y="${stY - 11}" width="75" height="22" rx="4" fill="${isReached ? 'rgba(27, 54, 93, 0.08)' : 'var(--bg-card-secondary)'}" stroke="var(--ticket-border)"/>
          <text x="62" y="${stY + 4}" font-family="var(--font-header)" font-size="10" fill="var(--ink-secondary)" text-anchor="middle" font-weight="600">กม. ${st.km}</text>

          <!-- ชื่อสถานีและไอคอน -->
          <text x="${lineX + 24}" y="${stY - 2}" font-family="var(--font-header)" font-size="14" font-weight="600" fill="${isReached ? 'var(--ink-primary)' : 'var(--ink-muted)'}">${st.name}</text>
          <text x="${lineX + 24}" y="${stY + 14}" font-family="var(--font-body)" font-size="11" fill="var(--ink-secondary)">${st.nameEn} • ${st.province}</text>

          <!-- ตราประทับกำกับ -->
          <text x="${svgWidth - 60}" y="${stY + 5}" font-size="18">${isUnlocked ? (st.icon || '✅') : '🔒'}</text>
        </g>
      `;
    });

    container.innerHTML = `
      <svg viewBox="0 0 ${svgWidth} ${svgHeight}" width="100%" height="auto">
        <!-- รางรถไฟช่วงที่ยังไม่ถึง (Dashed Inactive) -->
        <line x1="${lineX}" y1="${startY}" x2="${lineX}" y2="${endY}" stroke="var(--track-inactive)" stroke-width="6" stroke-dasharray="6,6" stroke-linecap="round"/>

        <!-- รางรถไฟช่วงที่วิ่งผ่านแล้ว (Solid Active) -->
        <line x1="${lineX}" y1="${startY}" x2="${lineX}" y2="${trainY}" stroke="var(--ink-primary)" stroke-width="6" stroke-linecap="round"/>

        <!-- สถานีทั้งหมด -->
        ${stationsSvg}

        <!-- หัวรถไฟที่ตำแหน่งปัจจุบัน -->
        <g transform="translate(${lineX - 18}, ${trainY - 14})" class="anim-train-rock">
          <circle cx="2" cy="-2" r="3" class="steam-particle"/>
          <rect x="0" y="2" width="36" height="20" rx="3" fill="var(--stamp-red)"/>
          <rect x="24" y="5" width="10" height="8" rx="1" fill="#facc15"/>
          <polygon points="36,12 40,22 36,22" fill="#333"/>
          <circle cx="8" cy="22" r="4" fill="#111" class="anim-wheel"/>
          <circle cx="28" cy="22" r="4" fill="#111" class="anim-wheel"/>
          <text x="18" y="16" font-size="8" fill="#fff" text-anchor="middle" font-weight="bold">รฟท</text>
        </g>
      </svg>
    `;

    // อัปเดตสถิติหน้าเส้นทาง
    const statsEl = document.getElementById('route-progress-stats');
    if (statsEl) {
      const pct = Math.min(100, Math.round((currentKm / totalKm) * 100));
      statsEl.innerHTML = `พิชิตแล้ว <strong>${currentKm}</strong> / ${totalKm} กม. (${pct}%) • ปลายทาง: <strong>${this.activeRoute.destination}</strong>`;
    }
  }

  // แสดง Modal ข้อมูลสถานี
  showStationDetail(stationId) {
    const st = this.activeRoute.stations.find(s => s.id === stationId);
    if (!st) return;

    const state = storage.getState();
    const stamp = state.stamps.find(s => s.stationId === st.id && s.routeId === this.activeRoute.id);
    const isUnlocked = !!stamp;

    const modal = document.getElementById('station-detail-modal');
    if (!modal) return;

    const bodyEl = document.getElementById('station-modal-content');
    if (bodyEl) {
      bodyEl.innerHTML = `
        <div style="font-size: 3rem; margin-bottom: 8px;">${st.icon || '🏛️'}</div>
        <h3 style="font-size: 1.4rem; color: var(--ink-primary); margin-bottom: 4px;">สถานี${st.name} (${st.nameEn})</h3>
        <p style="color: var(--ink-secondary); font-size: 0.9rem; margin-bottom: 12px;">จังหวัด${st.province} • กิโลเมตรที่ ${st.km}</p>
        <p style="background: var(--bg-card-secondary); padding: 10px; border-radius: var(--radius-sm); font-size: 0.9rem; margin-bottom: 16px;">
          "${st.tagline || 'สถานีรถไฟสำคัญแห่งหนึ่งของการรถไฟแห่งประเทศไทย'}"
        </p>
        <div style="font-size: 0.85rem; font-weight: 600; color: ${isUnlocked ? 'var(--stamp-green)' : 'var(--stamp-red)'};">
          ${isUnlocked ? `✅ ปลดล็อกตราประทับแล้ว (เมื่อ ${new Date(stamp.unlockedAt).toLocaleDateString('th-TH')})` : `🔒 ยังไม่ปลดล็อก (ต้องการระยะทางสะสม ${st.km} กม.)`}
        </div>
      `;
    }

    modal.classList.add('active');
  }

  // วาดหน้าพาสปอร์ตตราประทับ (Railway Stamp Passport)
  renderPassport() {
    const grid = document.getElementById('passport-stamps-grid');
    const fillEl = document.getElementById('passport-progress-fill');
    const labelEl = document.getElementById('passport-progress-label');
    if (!grid) return;

    const state = storage.getState();
    const stations = this.activeRoute.stations;
    const stamps = state.stamps || [];

    let unlockedCount = 0;
    grid.innerHTML = '';

    stations.forEach(st => {
      const stamp = stamps.find(s => s.stationId === st.id && s.routeId === this.activeRoute.id);
      const isUnlocked = !!stamp;
      if (isUnlocked) unlockedCount++;

      const slot = document.createElement('div');
      slot.className = `stamp-slot ${isUnlocked ? 'unlocked' : 'locked'}`;

      const dateStr = stamp ? new Date(stamp.unlockedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '';

      slot.innerHTML = `
        <div class="stamp-seal">
          <span class="stamp-seal-icon">${st.icon || '🚂'}</span>
          <span class="stamp-seal-name">${st.name}</span>
          <span class="stamp-seal-date">${isUnlocked ? dateStr : 'กม. ' + st.km}</span>
        </div>
        <div style="font-family: var(--font-header); font-size: 0.75rem; font-weight: 600;">
          ${st.name}
        </div>
        ${!isUnlocked ? `<div class="stamp-locked-km">ต้องการ ${st.km} กม.</div>` : ''}
      `;

      slot.addEventListener('click', () => {
        this.showStationDetail(st.id);
      });

      grid.appendChild(slot);
    });

    const pct = Math.round((unlockedCount / stations.length) * 100);
    if (fillEl) fillEl.style.width = `${pct}%`;
    if (labelEl) labelEl.textContent = `สะสมแล้ว ${unlockedCount} / ${stations.length} สถานี (${pct}%)`;
  }

  // วาดหน้าสถิติ
  renderStats() {
    const todayMinEl = document.getElementById('stat-today-min');
    const weekMinEl = document.getElementById('stat-week-min');
    const totalKmEl = document.getElementById('stat-total-km');
    const streakEl = document.getElementById('stat-streak-days');
    const historyList = document.getElementById('trip-history-list');

    const todayMin = storage.getTodayMinutes();
    const weekMin = storage.getWeekMinutes();
    const state = storage.getState();

    const formatMins = (m) => {
      const hrs = Math.floor(m / 60);
      const mins = m % 60;
      if (hrs > 0) return `${hrs} ชม. ${mins} นาที`;
      return `${mins} นาที`;
    };

    if (todayMinEl) todayMinEl.textContent = formatMins(todayMin);
    if (weekMinEl) weekMinEl.textContent = formatMins(weekMin);
    if (totalKmEl) totalKmEl.textContent = `${state.totalKm} กม.`;
    if (streakEl) streakEl.textContent = `${state.streak.current || 0} วัน (สูงสุด ${state.streak.max || 0} วัน)`;

    // รายการประวัติเที่ยว
    if (historyList) {
      historyList.innerHTML = '';
      const trips = state.trips || [];

      if (trips.length === 0) {
        historyList.innerHTML = `<div style="text-align: center; color: var(--ink-muted); padding: 20px;">ยังไม่มีประวัติการเดินทาง มาเริ่มอ่านเที่ยวแรกกันเลย! 🚂</div>`;
      } else {
        trips.slice(0, 15).forEach(t => {
          const item = document.createElement('div');
          item.className = 'history-item';
          const dateStr = new Date(t.endedAt || t.startedAt).toLocaleDateString('th-TH', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
          });

          item.innerHTML = `
            <div>
              <div class="history-subject">${t.subject}</div>
              <div class="history-meta">${dateStr} • ${t.durationMin} นาที</div>
            </div>
            <div style="text-align: right;">
              <span class="history-badge ${t.completed ? 'completed' : 'cancelled'}">
                ${t.completed ? `+${t.km} กม.` : 'ยกเลิก'}
              </span>
            </div>
          `;
          historyList.appendChild(item);
        });
      }
    }
  }

  // ค้นหาสถานีที่ใกล้ที่สุดไม่เกินระยะกิโลเมตรที่ระบุ
  findNearestStation(km) {
    const stations = this.activeRoute.stations;
    let found = stations[0];
    for (let i = stations.length - 1; i >= 0; i--) {
      if (km >= stations[i].km) {
        found = stations[i];
        break;
      }
    }
    return found;
  }

  // ตรวจสอบเที่ยวที่ค้างอยู่เมื่อเริ่มแอป (Boot Check)
  checkPendingTripOnBoot() {
    const savedTrip = storage.getCurrentTrip();
    if (savedTrip && savedTrip.endTime) {
      // มีเที่ยวที่กำลังวิ่งอยู่
      const resumed = trainTimer.resume(savedTrip);
      if (resumed) {
        const now = Date.now();
        if (now >= savedTrip.endTime) {
          // สิ้นสุดแล้วขณะปิดแอป -> ไปหน้าถึงสถานีทันที
          // timer.resume จัดการ triggerComplete แล้ว
        } else {
          // ยังวิ่งอยู่ -> ไปหน้าตัวจับเวลา
          this.navigateTo('screen-timer');
          this.renderTicketDOM('timer-ticket-container', savedTrip, true);
        }
        return;
      }
    }

    // ไม่มีเที่ยวค้าง -> ไปหน้าซื้อตั๋ว
    this.navigateTo('screen-buy-ticket');
  }

  // ตั้งค่าปุ่มใน Modal
  setupModals() {
    // Modal ยกเลิกเที่ยว
    const btnOpenCancel = document.getElementById('btn-open-cancel-modal');
    const cancelModal = document.getElementById('cancel-trip-modal');
    const btnConfirmCancel = document.getElementById('btn-confirm-cancel');
    const btnDismissCancel = document.getElementById('btn-dismiss-cancel');

    if (btnOpenCancel && cancelModal) {
      btnOpenCancel.addEventListener('click', () => {
        cancelModal.classList.add('active');
      });
    }

    if (btnConfirmCancel && cancelModal) {
      btnConfirmCancel.addEventListener('click', () => {
        cancelModal.classList.remove('active');
        trainTimer.cancel();
      });
    }

    if (btnDismissCancel && cancelModal) {
      btnDismissCancel.addEventListener('click', () => {
        cancelModal.classList.remove('active');
      });
    }

    // Modal ปิดข้อมูลสถานี
    const stationModal = document.getElementById('station-detail-modal');
    const btnCloseStationModal = document.getElementById('btn-close-station-modal');
    if (btnCloseStationModal && stationModal) {
      btnCloseStationModal.addEventListener('click', () => {
        stationModal.classList.remove('active');
      });
    }

    // ปิด modal เมื่อคลิกพื้นหลัง
    document.querySelectorAll('.modal-backdrop').forEach(mb => {
      mb.addEventListener('click', (e) => {
        if (e.target === mb) {
          mb.classList.remove('active');
        }
      });
    });

    // ปุ่มซื้อตั๋วเที่ยวต่อไปในหน้าถึงสถานี
    const btnNextTrip = document.getElementById('btn-next-trip');
    if (btnNextTrip) {
      btnNextTrip.addEventListener('click', () => {
        this.generateRandomTrainMeta();
        this.navigateTo('screen-buy-ticket');
      });
    }
  }

  // ตั้งค่าปุ่มโหมดมืดและเสียง
  setupSettingsToggles() {
    const darkBtn = document.getElementById('btn-toggle-dark');
    if (darkBtn) {
      darkBtn.addEventListener('click', () => {
        const isDark = document.body.classList.toggle('dark-mode');
        storage.updateSettings({ darkMode: isDark });
        darkBtn.textContent = isDark ? '☀️' : '🌙';
      });
    }

    const soundBtn = document.getElementById('btn-toggle-sound');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        soundEffects.enabled = !soundEffects.enabled;
        storage.updateSettings({ soundEnabled: soundEffects.enabled });
        soundBtn.textContent = soundEffects.enabled ? '🔊' : '🔇';
      });
    }

    // เปลี่ยนสายรถไฟ (Route Switcher)
    const routeSelect = document.getElementById('select-route');
    if (routeSelect) {
      routeSelect.innerHTML = RAILWAY_ROUTES.map(r => `
        <option value="${r.id}" ${r.id === this.activeRoute.id ? 'selected' : ''}>${r.name}</option>
      `).join('');

      routeSelect.addEventListener('change', (e) => {
        storage.setActiveRoute(e.target.value);
        this.loadActiveRoute();
        this.updateTicketPreview();
        this.renderRouteMap();
        this.renderPassport();
      });
    }
  }

  // ระบบ Export/Import และ Reset ข้อมูล
  setupDataTools() {
    const exportBtn = document.getElementById('btn-export-data');
    const importInput = document.getElementById('input-import-data');
    const resetBtn = document.getElementById('btn-reset-data');

    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const json = storage.exportDataJSON();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ptms-train-study-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      });
    }

    if (importInput) {
      importInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
          const success = storage.importDataJSON(event.target.result);
          if (success) {
            alert('นำเข้าข้อมูลเรียบร้อยแล้ว!');
            window.location.reload();
          } else {
            alert('ไฟล์ข้อมูลไม่ถูกต้อง');
          }
        };
        reader.readAsText(file);
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('คุณต้องการรีเซ็ตสถิติและตราประทับทั้งหมดหรือไม่? (การกระทำนี้ไม่สามารถย้อนกลับได้)')) {
          storage.resetAll();
          window.location.reload();
        }
      });
    }
  }
}

// เริ่มต้นแอปพลิเคชัน
let app = null;
window.addEventListener('DOMContentLoaded', () => {
  app = new TrainApp();
});
