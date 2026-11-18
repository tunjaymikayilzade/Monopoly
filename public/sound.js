// Fayl yoxdur: bütün səslər WebAudio ilə birbaşa brauzerdə sintez olunur.
let ctx = null, master = null, muted = false;
try { muted = localStorage.getItem('mono_mute') === '1'; } catch {}

export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.7;
    master.connect(comp); comp.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
}
export const isMuted = () => muted;
export function setMuted(m) {
  muted = m;
  try { localStorage.setItem('mono_mute', m ? '1' : '0'); } catch {}
  if (master) master.gain.value = m ? 0 : 0.7;
}

// --- Əsas bloklar ---
function tone({ f = 440, to = null, dur = 0.15, type = 'sine', vol = 0.25, at = 0, attack = 0.004 }) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}
let noiseBuf = null;
function noise({ dur = 0.08, vol = 0.2, at = 0, type = 'bandpass', f = 2000, q = 1, to = null }) {
  if (!ctx || muted) return;
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = ctx.currentTime + at;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.Q.value = q;
  fl.frequency.setValueAtTime(f, t);
  if (to) fl.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(master);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}
const bell = (f, at = 0, vol = 0.18, dur = 0.7) => {
  tone({ f, dur, vol, at, type: 'sine' });
  tone({ f: f * 2.76, dur: dur * 0.5, vol: vol * 0.35, at, type: 'sine' });
  tone({ f: f * 5.4, dur: dur * 0.25, vol: vol * 0.15, at, type: 'sine' });
};

// --- Oyun səsləri ---
export const sfx = {
  // fiqur hər xanaya keçəndə: yüngül taxta "tak"
  step(k = 0) {
    tone({ f: 520 + (k % 6) * 22, to: 260, dur: 0.06, type: 'triangle', vol: 0.22 });
    noise({ dur: 0.03, vol: 0.12, f: 3000, q: 0.8 });
  },
  // fiqur dayanıb lövhəyə qoyulanda: ağır "dap"
  place() {
    tone({ f: 190, to: 70, dur: 0.16, type: 'sine', vol: 0.55 });
    tone({ f: 420, to: 180, dur: 0.07, type: 'triangle', vol: 0.25 });
    noise({ dur: 0.06, vol: 0.28, type: 'lowpass', f: 1400 });
  },
  diceRoll() {
    let t = 0;
    for (let i = 0; i < 12; i++) {
      noise({ dur: 0.05, vol: 0.16 + Math.random() * 0.1, at: t, f: 1800 + Math.random() * 2600, q: 2 });
      tone({ f: 700 + Math.random() * 500, to: 300, dur: 0.03, type: 'square', vol: 0.05, at: t });
      t += 0.03 + i * 0.012;
    }
  },
  diceLand() {
    for (const at of [0, 0.09]) {
      tone({ f: 150, to: 60, dur: 0.1, vol: 0.5, at });
      noise({ dur: 0.05, vol: 0.3, at, type: 'lowpass', f: 1800 });
    }
  },
  cashIn() { bell(1319, 0, 0.14, 0.35); bell(1760, 0.08, 0.14, 0.5); noise({ dur: 0.2, vol: 0.05, at: 0.05, type: 'highpass', f: 6000 }); },
  cashOut() { tone({ f: 880, to: 700, dur: 0.12, type: 'triangle', vol: 0.18 }); tone({ f: 660, to: 500, dur: 0.18, type: 'triangle', vol: 0.18, at: 0.09 }); },
  buy() {
    noise({ dur: 0.04, vol: 0.3, f: 4000 });
    bell(1568, 0.05, 0.2, 0.9); bell(2093, 0.1, 0.16, 1.0);
    tone({ f: 300, to: 200, dur: 0.1, vol: 0.2 });
  },
  build() {
    for (const at of [0, 0.16, 0.32]) {
      tone({ f: 210, to: 110, dur: 0.08, type: 'triangle', vol: 0.4, at });
      noise({ dur: 0.04, vol: 0.3, at, f: 1500 });
    }
  },
  sell() { tone({ f: 500, to: 220, dur: 0.18, type: 'sawtooth', vol: 0.12 }); noise({ dur: 0.1, vol: 0.1, f: 900 }); },
  card() {
    noise({ dur: 0.25, vol: 0.18, type: 'bandpass', f: 800, to: 5000, q: 0.7 });
    [659, 784, 988, 1319].forEach((f, i) => bell(f, 0.18 + i * 0.07, 0.1, 0.5));
  },
  jail() {
    for (const f of [247, 392, 554]) tone({ f, dur: 0.7, type: 'sawtooth', vol: 0.07 });
    tone({ f: 90, to: 45, dur: 0.35, vol: 0.55 });
    noise({ dur: 0.3, vol: 0.2, f: 2500, q: 4 });
    for (const at of [0.25, 0.4]) { tone({ f: 1100, to: 900, dur: 0.15, vol: 0.1, at }); }
  },
  go() { [523, 659, 784, 1047].forEach((f, i) => { tone({ f, dur: 0.22, type: 'triangle', vol: 0.2, at: i * 0.09 }); bell(f * 2, i * 0.09, 0.05, 0.4); }); },
  yourTurn() { bell(784, 0, 0.16, 0.5); bell(1047, 0.14, 0.16, 0.7); },
  trade() { bell(880, 0, 0.2, 0.8); bell(880, 0.25, 0.2, 0.8); },
  tradeDone() { sfx.cashIn(); setTimeout(() => sfx.cashIn(), 160); },
  rent() { sfx.cashOut(); },
  bankrupt() { tone({ f: 260, to: 110, dur: 1.0, type: 'sawtooth', vol: 0.16 }); tone({ f: 130, to: 55, dur: 1.0, type: 'square', vol: 0.08 }); },
  win() {
    [523, 523, 523, 659, 784, 1047].forEach((f, i) => { tone({ f, dur: 0.3, type: 'triangle', vol: 0.22, at: i * 0.14 }); bell(f * 2, i * 0.14, 0.06, 0.6); });
    noise({ dur: 1.2, vol: 0.07, at: 0.6, type: 'highpass', f: 5000 });
  },
  click() { tone({ f: 900, to: 600, dur: 0.04, type: 'triangle', vol: 0.1 }); },
  error() { tone({ f: 200, to: 150, dur: 0.15, type: 'square', vol: 0.1 }); },
};
