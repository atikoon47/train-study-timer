/**
 * ระบบเสียงสังเคราะห์ด้วย Web Audio API (ไม่ต้องพึ่งพาไฟล์เสียงภายนอก)
 * ทำงานได้ 100% ออฟไลน์ ปราศจากปัญหา 404
 */
class TrainSoundEffects {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.vibrateEnabled = true;
  }

  // เริ่มต้นหรือปลุก AudioContext หลังมี user interaction
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  // เสียงกระดาษตั๋วถูกฉีก (Paper Tear Sound)
  playTear() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * 0.28; // 280ms
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);

      // สร้าง noise ที่มีคาแรกเตอร์ของกระดาษฉีกขาด
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // เพิ่ม crackle สุ่ม
        const crackle = Math.random() > 0.92 ? (Math.random() * 2 - 1) * 1.5 : 0;
        data[i] = (white + crackle) * (1 - i / bufferSize);
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      // Bandpass filter เลียนแบบเสียงกระดาษ
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.frequency.exponentialRampToValueAtTime(700, now + 0.25);
      filter.Q.setValueAtTime(2.2, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.6, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start(now);
      noise.stop(now + 0.28);
    } catch (e) {
      console.warn('Audio playTear error:', e);
    }
  }

  // เสียงหวูดรถไฟ (Train Whistle Chord)
  playWhistle() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      // คอร์ดเสียงหวูดรถไฟไทยแบบ 2 โทน (A4 และ C#5)
      const freqs = [440, 554.37];

      freqs.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);
        // Vibrato เล็กน้อยเหมือนลมเป่า
        osc.frequency.linearRampToValueAtTime(freq * 1.01, now + 0.3);
        osc.frequency.linearRampToValueAtTime(freq * 0.99, now + 0.6);

        // Lowpass filter ให้นุ่มนวล
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1200, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.18, now + 0.15);
        gain.gain.setValueAtTime(0.18, now + 0.8);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 1.45);
      });
    } catch (e) {
      console.warn('Audio playWhistle error:', e);
    }
  }

  // เสียงระฆังสถานีรถไฟ (Station Chime / Bell) เมื่ออ่านครบเวลา
  playStationBell() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      // เสียงระฆัง 2 จังหวะ "ดิ่ง-ด่อง" สไตล์สถานี
      const notes = [
        { freq: 659.25, time: 0.0, dur: 1.2 }, // E5
        { freq: 523.25, time: 0.35, dur: 1.8 } // C5
      ];

      notes.forEach(n => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(n.freq, now + n.time);

        gain.gain.setValueAtTime(0.0001, now + n.time);
        gain.gain.linearRampToValueAtTime(0.35, now + n.time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + n.time + n.dur);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + n.time);
        osc.stop(now + n.time + n.dur);
      });
    } catch (e) {
      console.warn('Audio playStationBell error:', e);
    }
  }

  // เสียงประทับตราพาสปอร์ต (Stamp Thud)
  playStamp() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.12);

      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.16);
    } catch (e) {
      console.warn('Audio playStamp error:', e);
    }
  }

  // สั่นมือถือ (Haptic Feedback)
  vibrate(pattern = 50) {
    if (!this.vibrateEnabled) return;
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(pattern);
      }
    } catch (e) {
      // ละเว้นหากอุปกรณ์ไม่รองรับ
    }
  }
}

// สร้าง singleton ไว้ใช้งานทั่วทั้งแอป
const soundEffects = new TrainSoundEffects();
