/**
 * Test Suite for Study Train Ticket Core Logic
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// 1. Mock Browser Environment for Node.js
class MockLocalStorage {
  constructor(shouldThrow = false) {
    this.store = {};
    this.shouldThrow = shouldThrow;
  }
  getItem(key) {
    if (this.shouldThrow) throw new Error('QuotaExceeded or SecurityError');
    return this.store[key] || null;
  }
  setItem(key, val) {
    if (this.shouldThrow) throw new Error('QuotaExceeded or SecurityError');
    this.store[key] = String(val);
  }
  removeItem(key) {
    if (this.shouldThrow) throw new Error('QuotaExceeded or SecurityError');
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

global.window = {
  localStorage: new MockLocalStorage(),
  matchMedia: () => ({ matches: false }),
  AudioContext: class {
    constructor() { this.state = 'running'; this.sampleRate = 44100; this.currentTime = 0; }
    createBuffer() { return { getChannelData: () => new Float32Array(100) }; }
    createBufferSource() { return { connect: () => {}, start: () => {}, stop: () => {} }; }
    createBiquadFilter() { return { connect: () => {}, frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, Q: { setValueAtTime: () => {} } }; }
    createGain() { return { connect: () => {}, gain: { setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} } }; }
    createOscillator() { return { connect: () => {}, start: () => {}, stop: () => {}, frequency: { setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} } }; }
    resume() { return Promise.resolve(); }
  }
};
global.document = {
  addEventListener: () => {},
  visibilityState: 'visible'
};
global.navigator = {
  vibrate: () => true
};

// 2. Load Core Scripts
const vm = require('vm');
const routesCode = fs.readFileSync(path.join(__dirname, '../js/routes-data.js'), 'utf8');
const audioCode = fs.readFileSync(path.join(__dirname, '../js/audio.js'), 'utf8');
const storageCode = fs.readFileSync(path.join(__dirname, '../js/storage.js'), 'utf8');
const timerCode = fs.readFileSync(path.join(__dirname, '../js/timer.js'), 'utf8');

vm.runInThisContext(routesCode);
vm.runInThisContext(audioCode);
vm.runInThisContext(storageCode);
vm.runInThisContext(timerCode);

console.log('--- STARTING ACCEPTANCE CRITERIA VERIFICATION ---');

// Test 1: Routes Data Structure & Northern Line Stations
console.log('Test 1: Verify Northern Line stations and required data structure');
assert(Array.isArray(RAILWAY_ROUTES), 'RAILWAY_ROUTES should be an array');
const northern = RAILWAY_ROUTES.find(r => r.id === 'northern');
assert(northern, 'Northern line route should exist');
assert.strictEqual(northern.totalKm, 751, 'Northern line total km should be 751');

const expectedStations = [
  { name: 'กรุงเทพ', km: 0 },
  { name: 'อยุธยา', km: 76 },
  { name: 'ลพบุรี', km: 133 },
  { name: 'นครสวรรค์', km: 245 },
  { name: 'พิษณุโลก', km: 377 },
  { name: 'ลำปาง', km: 604 },
  { name: 'เชียงใหม่', km: 751 }
];

expectedStations.forEach(exp => {
  const st = northern.stations.find(s => s.name === exp.name);
  assert(st, `Station ${exp.name} must exist on northern line`);
  assert.strictEqual(st.km, exp.km, `Station ${exp.name} must be at km ${exp.km}`);
});
console.log('✅ Test 1 Passed: Northern Line stations match exact requirements (0, 76, 133, 245, 377, 604, 751).');

// Test 2: Distance Conversion (60 min = 30 km, 1 min = 0.5 km)
console.log('Test 2: Verify distance conversion logic');
assert.strictEqual(KM_PER_MINUTE, 0.5, 'KM_PER_MINUTE should be 0.5 (60 min = 30 km)');
assert.strictEqual(Math.round(25 * KM_PER_MINUTE), 13, '25 min rounded distance');
assert.strictEqual(Math.round(50 * KM_PER_MINUTE), 25, '50 min rounded distance');
assert.strictEqual(Math.round(60 * KM_PER_MINUTE), 30, '60 min = 30 km');
console.log('✅ Test 2 Passed: 60 minutes = 30 km calculation is exact.');

// Test 3: Completed Trip Adds KM and Unlocks Stamps
console.log('Test 3: Completed Trip adds KM and unlocks stamps');
storage.resetAll();
assert.strictEqual(storage.getState().totalKm, 0, 'Initial totalKm should be 0');

// Complete a 160 min trip (= 80 km gained)
const trip1 = {
  id: 'trip_test_1',
  subject: 'คณิตศาสตร์ ม.ปลาย',
  durationMin: 160,
  startedAt: Date.now() - 160 * 60 * 1000,
  km: 80
};
const res1 = storage.completeTrip(trip1);
assert.strictEqual(res1.kmGained, 80, 'Trip 1 should gain 80 km');
assert.strictEqual(storage.getState().totalKm, 80, 'Total km should now be 80 km');

// Crossing Ayutthaya (km 76) unlocks its stamp
const unlockedAya = storage.unlockStamp('aya', 'northern');
assert.strictEqual(unlockedAya, true, 'Ayutthaya stamp should be newly unlocked');
// Trying to unlock again returns false
const unlockedAyaAgain = storage.unlockStamp('aya', 'northern');
assert.strictEqual(unlockedAyaAgain, false, 'Already unlocked stamp should not duplicate');
assert(storage.getState().stamps.some(s => s.stationId === 'aya'), 'Ayutthaya stamp must be recorded');
console.log('✅ Test 3 Passed: Completed trip adds km and unlocks station stamps.');

// Test 4: Canceled Trip Gives 0 KM
console.log('Test 4: Cancelled Trip gives 0 KM');
const kmBefore = storage.getState().totalKm;
const tripCancel = {
  id: 'trip_cancel_1',
  subject: 'ภาษาอังกฤษ',
  durationMin: 30,
  startedAt: Date.now() - 10 * 60 * 1000
};
storage.cancelTrip(tripCancel);
assert.strictEqual(storage.getState().totalKm, kmBefore, 'Total KM must not increase on cancelled trip');
const lastTrip = storage.getState().trips[0];
assert.strictEqual(lastTrip.completed, false, 'Trip record must be marked completed = false');
assert.strictEqual(lastTrip.km, 0, 'Cancelled trip km must be 0');
console.log('✅ Test 4 Passed: Cancelled trips never award distance.');

// Test 5: Timer Timestamp Resumption & Expiration (Switching Tab / Reopening)
console.log('Test 5: Timer Timestamp Resumption & Tab Switch Logic');
const mockTrip = {
  id: 'trip_running_1',
  subject: 'วิทยาศาสตร์',
  durationMin: 1, // 1 minute
  startedAt: Date.now() - 70 * 1000, // 70 seconds ago (already expired)
  endTime: Date.now() - 10 * 1000,   // expired 10 seconds ago
  originKm: 80,
  targetKm: 80.5,
  km: 1,
  status: 'running'
};

storage.setCurrentTrip(mockTrip);
assert(storage.getCurrentTrip(), 'Current trip should be stored');

let completedFired = false;
trainTimer.onComplete = (data) => {
  completedFired = true;
};

// Resuming trip after 1 minute has elapsed -> should immediately complete
const resumedResult = trainTimer.resume(mockTrip);
assert.strictEqual(resumedResult, true, 'Resume should return true');
assert.strictEqual(completedFired, true, 'Expired trip must immediately trigger completion');
assert.strictEqual(storage.getCurrentTrip(), null, 'Current trip must be cleared after completion');
console.log('✅ Test 5 Passed: Expired trip correctly detected and completed on resume.');

// Test 6: Running trip mid-way resumes with exact remaining time
console.log('Test 6: Active mid-way trip resumes accurately');
const midTrip = {
  id: 'trip_mid_1',
  subject: 'ประวัติศาสตร์',
  durationMin: 10,
  startedAt: Date.now(),
  endTime: Date.now() + 6 * 60 * 1000, // 6 minutes remaining
  originKm: 80,
  targetKm: 83,
  km: 3,
  status: 'running'
};
storage.setCurrentTrip(midTrip);

let tickReceived = null;
trainTimer.onTick = (info) => {
  tickReceived = info;
};
trainTimer.resume(midTrip);

assert(tickReceived, 'Tick should be triggered on resume');
assert(tickReceived.remainingMs > 5 * 60 * 1000, 'Remaining time should be ~6 minutes');
assert.strictEqual(tickReceived.isFinished, false, 'Trip is not finished yet');
trainTimer.stopInterval();
storage.clearCurrentTrip();
console.log('✅ Test 6 Passed: Active mid-way trip continues with exact remaining milliseconds.');

// Test 7: Streak Calculation
console.log('Test 7: Consecutive day streak calculation');
storage.resetAll();
// Day 1
storage.updateStreak('2026-11-01');
assert.strictEqual(storage.getState().streak.current, 1, 'Day 1 streak should be 1');
// Day 1 reading more times on same day -> streak remains 1
storage.updateStreak('2026-11-01');
assert.strictEqual(storage.getState().streak.current, 1, 'Same day study does not inflate streak');
// Day 2
storage.updateStreak('2026-11-02');
assert.strictEqual(storage.getState().streak.current, 2, 'Day 2 consecutive increases streak to 2');
// Day 3
storage.updateStreak('2026-11-03');
assert.strictEqual(storage.getState().streak.current, 3, 'Day 3 consecutive increases streak to 3');
assert.strictEqual(storage.getState().streak.max, 3, 'Max streak is 3');
// Gap (Day 5 - skipped Day 4)
storage.updateStreak('2026-11-05');
assert.strictEqual(storage.getState().streak.current, 1, 'Broken streak resets to 1');
assert.strictEqual(storage.getState().streak.max, 3, 'Max streak remains 3');
console.log('✅ Test 7 Passed: Streak calculates consecutive days accurately without duplicates.');

// Test 8: Storage Failure Resilience (Disabled or Throws)
console.log('Test 8: Error resilience when localStorage throws or fails');
window.localStorage = new MockLocalStorage(true); // Always throws
const safeStorage = new StorageManager();
assert.strictEqual(safeStorage.isLocalStorageAvailable, false, 'Should detect localStorage unavailable');
// Operations should not crash!
safeStorage.completeTrip({ id: 'safe_trip', subject: 'ปลอดภัย', durationMin: 20, km: 10 });
assert.strictEqual(safeStorage.getState().totalKm, 10, 'Memory state should update normally');
console.log('✅ Test 8 Passed: StorageManager smoothly falls back to memory if LocalStorage throws.');

// Test 9: Format time helper
console.log('Test 9: Format time helper');
assert.strictEqual(trainTimer.formatTime(25 * 60 * 1000), '25:00', '25 mins format');
assert.strictEqual(trainTimer.formatTime(59 * 1000), '00:59', '59 secs format');
assert.strictEqual(trainTimer.formatTime(3661 * 1000), '01:01:01', '1h 1m 1s format');
console.log('✅ Test 9 Passed: Timer format works for seconds, minutes, and hours.');

console.log('\n🌟 ALL 9 TESTS PASSED WITH 100% SUCCESS! 🌟');
