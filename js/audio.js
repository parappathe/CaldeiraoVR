// Sons sintetizados na hora (sem arquivos). Só liga depois de um clique ou da entrada no VR;
// os testes nunca chamam unlock, então nunca tocam nada.
export class Sfx {
  constructor() { this.ctx = null; this.on = true; }

  unlock() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.on ? 0.9 : 0;
      this.master.connect(this.ctx.destination);
      this.white = this.makeNoise(3, false);
      this.brown = this.makeNoise(3, true);
      this.startAmbience();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  setOn(v) {
    this.on = v;
    if (this.master) this.master.gain.setTargetAtTime(v ? 0.9 : 0, this.ctx.currentTime, 0.05);
  }
  makeNoise(sec, brown) {
    const c = this.ctx;
    const buf = c.createBuffer(1, Math.ceil(c.sampleRate * sec), c.sampleRate);
    const d = buf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { b = 0.98 * b + 0.02 * w; d[i] = b * 7; } else d[i] = w * 0.5;
    }
    return buf;
  }
  loop(buf, type, freq, q) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = buf; src.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start();
    return { f, g };
  }
  tone(freq, dur, { type = 'sine', vol = 0.2, at = 0, slide = 0, attack = 0.004 } = {}) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, { vol = 0.1, freq = 1200, q = 1, at = 0, type = 'bandpass', attack = 0, sweep = 0 } = {}) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + at;
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.white;
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * sweep), t + dur);
    g.gain.setValueAtTime(attack ? 0.0001 : vol, t);
    if (attack) g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t, Math.random() * 2); src.stop(t + dur + 0.05);
  }

  click() { this.tone(880, 0.05, { vol: 0.07, type: 'square' }); }
  good() { [523, 659, 784].forEach((f, i) => this.tone(f, 0.25, { vol: 0.1, type: 'triangle', at: i * 0.08 })); }
  bad() { this.tone(330, 0.5, { vol: 0.1, type: 'triangle', slide: 0.7 }); this.tone(262, 0.6, { vol: 0.06, type: 'sine', slide: 0.7, at: 0.12 }); }
  fanfare() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, i === 5 ? 0.7 : 0.18, { vol: 0.12, type: 'triangle', at: i * 0.12 })); }
  star(n) { this.tone(784 * (1 + n * 0.26), 0.35, { vol: 0.12, type: 'triangle' }); }

  // ---- Caldeirão ----
  pick() { this.tone(1200, 0.06, { vol: 0.06, type: 'triangle', slide: 1.3 }); this.tone(1800, 0.05, { vol: 0.03, type: 'sine', at: 0.03 }); }
  // glub-glub do frasco caindo no caldeirão
  pour() { [0, 0.09, 0.2].forEach((at, i) => this.tone(220 - i * 30, 0.12, { vol: 0.09, type: 'sine', slide: 2.2, at })); this.noise(0.25, { vol: 0.05, freq: 600, q: 2, at: 0.05 }); }
  empty() { this.noise(0.5, { vol: 0.08, freq: 900, q: 0.8, sweep: 0.3 }); this.tone(300, 0.3, { vol: 0.05, type: 'sine', slide: 0.5 }); }
  stir() { this.noise(0.35, { vol: 0.05, freq: 500, q: 1.5, attack: 0.08, sweep: 1.6 }); }
  // lançar: subida com brilho
  cast(el) { const base = { fogo: 180, agua: 260, vento: 330, terra: 120, gelo: 520, luz: 640, sombra: 150, veneno: 220 }[el] || 300;
    this.tone(base, 0.5, { vol: 0.1, type: 'sawtooth', slide: 3 }); this.noise(0.6, { vol: 0.08, freq: base * 4, q: 1.2, attack: 0.1, sweep: 2 }); }
  hit() { this.noise(0.35, { vol: 0.22, freq: 300, q: 0.7, type: 'lowpass' }); this.tone(90, 0.3, { vol: 0.14, type: 'sine', slide: 0.5 }); }
  block() { [1320, 1760, 2640].forEach((f, i) => this.tone(f, 0.5, { vol: 0.05, type: 'sine', at: i * 0.02 })); this.noise(0.12, { vol: 0.08, freq: 4000, q: 2 }); }
  heal() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.4, { vol: 0.06, type: 'sine', at: i * 0.07 })); }
  shield() { this.tone(440, 0.6, { vol: 0.07, type: 'triangle', slide: 1.5 }); this.tone(660, 0.6, { vol: 0.05, type: 'sine', slide: 1.5, at: 0.05 }); }
  poison() { for (let k = 0; k < 5; k++) this.tone(160 + Math.random() * 80, 0.08, { vol: 0.06, type: 'sine', slide: 2, at: k * 0.07 }); }
  stun() { this.tone(900, 0.12, { vol: 0.08, type: 'square', slide: 0.5 }); [1200, 1500, 1800].forEach((f, i) => this.tone(f, 0.15, { vol: 0.04, type: 'sine', at: 0.15 + i * 0.1 })); }
  reflect() { this.tone(1000, 0.3, { vol: 0.07, type: 'triangle', slide: 0.5 }); this.tone(500, 0.3, { vol: 0.07, type: 'triangle', slide: 2, at: 0.15 }); }
  // gororoba: "bloop" e arroto
  goro() { this.tone(140, 0.25, { vol: 0.1, type: 'square', slide: 0.6 }); this.tone(90, 0.35, { vol: 0.08, type: 'sawtooth', slide: 0.7, at: 0.2 }); this.noise(0.2, { vol: 0.05, freq: 300, q: 3, at: 0.25 }); }
  deny() { this.tone(180, 0.15, { vol: 0.08, type: 'square' }); }
  discover() { [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.3, { vol: 0.06, type: 'triangle', at: i * 0.09 })); }

  // Cabana à noite: borbulhar do caldeirão, grilos e uma coruja de vez em quando
  startAmbience() {
    this.bub = this.loop(this.brown, 'lowpass', 380, 1);
    this.bub.g.gain.value = 0.05;
    this.cricketT = 0; this.owlT = 6;
  }
  updateAmbience(dt) {
    if (!this.ctx) return;
    this.cricketT -= dt; this.owlT -= dt;
    if (Math.random() < dt * 3) this.tone(180 + Math.random() * 120, 0.06, { vol: 0.02, type: 'sine', slide: 2.5 });
    if (this.cricketT <= 0) { this.cricketT = 0.9 + Math.random() * 1.5; for (let k = 0; k < 3; k++) this.tone(4400, 0.03, { vol: 0.008, type: 'sine', at: k * 0.06 }); }
    if (this.owlT <= 0) { this.owlT = 14 + Math.random() * 12; this.tone(400, 0.3, { vol: 0.02, type: 'sine', slide: 0.9 }); this.tone(380, 0.5, { vol: 0.02, type: 'sine', slide: 0.85, at: 0.45 }); }
  }
}
