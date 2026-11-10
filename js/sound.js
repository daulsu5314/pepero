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

// 하뀨하 공장 전용 오리지널 8비트 멜로디 (C장조, 경쾌한 제과점 느낌)
// [음 높이(Hz), 길이(박)] — 0 은 쉼표
const N = { C4: 262, D4: 294, E4: 330, F4: 349, G4: 392, A4: 440, B4: 494, C5: 523, D5: 587, E5: 659, F5: 698, G5: 784, A5: 880 };
const MELODY = [
  ['E5',1],['G5',1],['C5',1],['E5',1], ['D5',1],['F5',1],['A4',2],
  ['G4',1],['C5',1],['E5',1],['G5',1], ['F5',1],['E5',1],['D5',2],
  ['E5',1],['G5',1],['A5',1],['G5',1], ['F5',1],['E5',1],['D5',1],['C5',1],
  ['D5',1],['E5',1],['D5',1],['B4',1], ['C5',3],[0,1],
];
const BASS = ['C4','C4','F4','F4','G4','G4','C4','C4','A4','A4','F4','F4','G4','G4','C4','C4'];
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
      // 박 단위로 진행 (1박 = 220ms)
      let beat = 0, idx = 0, left = 0;
      bgmTimer = setInterval(() => {
        if (left <= 0) {
          const [n, len] = MELODY[idx % MELODY.length];
          if (n) tone(N[n], len * 0.2, 'square', 0.022);
          left = len; idx++;
        }
        left--;
        if (beat % 2 === 0) tone(N[BASS[(beat / 2) % BASS.length]] / 2, 0.16, 'triangle', 0.03);
        if (beat % 4 === 2) tone(1800, 0.02, 'square', 0.006);
        beat++;
      }, 220);
      return true;
    }
  },
};
