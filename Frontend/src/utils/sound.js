// Tiny WebAudio key-sound engine (no audio files, no dependencies).
//   prefs.keyboardSounds -> mechanical-keyboard "thock"
//   prefs.sound          -> soft click
// If both are on, only the keyboard sound plays (no doubled clicks).
// Also plays the tournament countdown beeps (3-2-1) and the GO tone; these
// follow the same sound settings (muted only if BOTH sound toggles are off).
import { getPrefs } from './prefs';

let ctx = null;
let noiseBuf = null;

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch { return null; }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function noise(c) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, Math.floor(c.sampleRate * 0.05), c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function click(c, correct) {
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(correct ? 1800 : 520, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.12, t + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.04);
}

function thock(c, correct) {
  const t = c.currentTime;
  // body: quick low sine drop
  const osc = c.createOscillator();
  const og = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(correct ? 220 : 150, t);
  osc.frequency.exponentialRampToValueAtTime(90, t + 0.06);
  og.gain.setValueAtTime(0.0001, t);
  og.gain.exponentialRampToValueAtTime(0.25, t + 0.003);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
  osc.connect(og).connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.09);
  // top: filtered noise "clack"
  const src = c.createBufferSource();
  src.buffer = noise(c);
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = correct ? 2400 : 1200;
  const ng = c.createGain();
  ng.gain.setValueAtTime(0.18, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
  src.connect(filter).connect(ng).connect(c.destination);
  src.start(t);
}

export function playKeySound(correct = true) {
  try {
    const prefs = getPrefs();
    if (!prefs.sound && !prefs.keyboardSounds) return;
    const c = audio();
    if (!c) return;
    if (prefs.keyboardSounds) thock(c, correct);
    else click(c, correct);
  } catch { /* audio must never break typing */ }
}

// Browsers only let audio start after a user gesture. Unlock the audio engine
// on the first click/key press anywhere so the countdown can beep even if the
// player has not typed yet.
if (typeof window !== 'undefined') {
  const unlock = () => {
    audio();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
}

function tone(c, freq, start, dur, vol = 0.22, type = 'sine') {
  const t = c.currentTime + start;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function soundOn() {
  const prefs = getPrefs();
  return !!(prefs.sound || prefs.keyboardSounds);
}

// One beep per countdown second (3, 2, 1).
export function playCountdownBeep() {
  try {
    if (!soundOn()) return;
    const c = audio();
    if (!c) return;
    tone(c, 880, 0, 0.16, 0.22, 'sine');
  } catch { /* audio must never break the race */ }
}

// Higher, longer two-note tone when the race starts.
export function playGoBeep() {
  try {
    if (!soundOn()) return;
    const c = audio();
    if (!c) return;
    tone(c, 1320, 0, 0.18, 0.26, 'triangle');
    tone(c, 1760, 0.12, 0.32, 0.26, 'triangle');
  } catch { /* audio must never break the race */ }
}