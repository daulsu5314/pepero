// 효과음 + 배경음악 (파일 없이 8비트 소리를 합성)
// assets/sounds/bgm.mp3 를 넣으면 그 파일을 배경음악으로 사용해요.
let ctx = null;
function ac() {
  if (!ctx) { const C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ctx = new C(); }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function tone(freq, dur = 0.08, type = 'square', vol = 0.04, when = 0) {
  const c = ac(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  const t = c.currentTime + when;
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

const MELODY = [523, 659, 784, 659, 587, 698, 880, 698, 523, 659, 784, 1047, 988, 784, 659, 0];
let bgmTimer = null, bgmAudio = null, bgmStep = 0;

export const sound = {
  bgmOn: false,
  click() { tone(880, 0.05); tone(1320, 0.05, 'square', 0.03, 0.04); },
  step(i) { tone(523 + i * 45, 0.1, 'triangle', 0.06); tone(784 + i * 45, 0.08, 'square', 0.025, 0.09); },
  pop() { tone(300, 0.08, 'square', 0.05); tone(600, 0.12, 'square', 0.04, 0.06); },
  fanfare() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i === 5 ? 0.4 : 0.14, 'square', 0.05, i * 0.13)); },
  gentle() { [784, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.06, i * 0.15)); },
  async toggleBgm() {
    this.bgmOn = !this.bgmOn;
    if (!this.bgmOn) {
      clearInterval(bgmTimer); bgmTimer = null;
      if (bgmAudio) bgmAudio.pause();
      return false;
    }
    if (!bgmAudio) {
      bgmAudio = new Audio('assets/sounds/bgm.mp3');
      bgmAudio.loop = true; bgmAudio.volume = 0.4;
    }
    try { await bgmAudio.play(); return true; }
    catch {
      bgmAudio = { pause() {}, play() { return Promise.reject(); } }; // 파일 없음 → 합성음
      bgmTimer = setInterval(() => {
        const f = MELODY[bgmStep++ % MELODY.length];
        if (f) tone(f, 0.18, 'triangle', 0.025);
        if (bgmStep % 4 === 1) tone(131, 0.2, 'square', 0.015);
      }, 260);
      return true;
    }
  },
};
