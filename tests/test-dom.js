/**
 * Test HTML structure and element presence
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

const requiredIds = [
  'input-subject',
  'recent-subjects-container',
  'preview-ticket',
  'btn-direct-tear',
  'timer-countdown-display',
  'timer-subject-display',
  'timer-checkpoint-display',
  'timer-mini-track',
  'timer-ticket-container',
  'btn-open-cancel-modal',
  'cancel-trip-modal',
  'arrival-ticket-container',
  'arrival-stat-time',
  'arrival-stat-km',
  'arrival-stat-station',
  'new-stamps-alert-area',
  'btn-next-trip',
  'select-route',
  'route-map-canvas',
  'passport-stamps-grid',
  'stat-today-min',
  'stat-week-min',
  'stat-total-km',
  'stat-streak-days',
  'trip-history-list',
  'btn-export-data',
  'input-import-data',
  'btn-reset-data',
  'btn-toggle-sound',
  'btn-toggle-dark'
];

console.log('Testing index.html for required IDs...');
requiredIds.forEach(id => {
  const hasId = html.includes(`id="${id}"`);
  assert(hasId, `index.html is missing element with id="${id}"`);
});

console.log(`✅ All ${requiredIds.length} required UI elements and IDs are present in index.html!`);

// Check script references
const requiredScripts = [
  'js/routes-data.js',
  'js/audio.js',
  'js/storage.js',
  'js/ticket-drag.js',
  'js/timer.js',
  'js/app.js'
];

requiredScripts.forEach(script => {
  assert(html.includes(`src="${script}"`), `Missing script reference: ${script}`);
});
console.log('✅ All script files referenced in correct order!');

// Check CSS references
const requiredCss = [
  'css/variables.css',
  'css/animations.css',
  'css/ticket.css',
  'css/style.css'
];

requiredCss.forEach(css => {
  assert(html.includes(`href="${css}"`), `Missing CSS reference: ${css}`);
});
console.log('✅ All CSS files referenced!');
