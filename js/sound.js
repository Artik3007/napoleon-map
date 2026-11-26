/* Звуки синтезируются на лету через Web Audio — никаких файлов не нужно. */
const Sound = (() => {
  let ctx = null, on = true;
  const ensure = () => {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  const noise = (dur) => {
    const c = ctx, b = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(); s.buffer = b; return s;
  };
  function boom(vol = 1) {
    if (!on || !ensure()) return;
    const t = ctx.currentTime;
    // гул выстрела
    const n = noise(2.2), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(60, t + 1.8);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9 * vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.1);
    n.connect(lp).connect(g).connect(ctx.destination); n.start(t); n.stop(t + 2.2);
    // удар
    const o = ctx.createOscillator(), og = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(32, t + 0.5);
    og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.8 * vol, t + 0.01); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.connect(og).connect(ctx.destination); o.start(t); o.stop(t + 0.8);
  }
  function rustle() {
    if (!on || !ensure()) return;
    const t = ctx.currentTime, n = noise(0.5), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    bp.type = 'bandpass'; bp.frequency.setValueAtTime(2500, t); bp.frequency.linearRampToValueAtTime(5200, t + 0.35); bp.Q.value = 0.7;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.25, t + 0.08); g.gain.linearRampToValueAtTime(0.12, t + 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.48);
    n.connect(bp).connect(g).connect(ctx.destination); n.start(t); n.stop(t + 0.5);
  }
  function bell(ok = true) {
    if (!on || !ensure()) return;
    const t = ctx.currentTime;
    (ok ? [660, 880, 1320] : [220, 196]).forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = ok ? 'triangle' : 'sawtooth'; o.frequency.value = f;
      const s = t + i * (ok ? 0.09 : 0.14);
      g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(ok ? 0.18 : 0.08, s + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, s + (ok ? 0.6 : 0.35));
      o.connect(g).connect(ctx.destination); o.start(s); o.stop(s + 0.7);
    });
  }
  /* Барабанная дробь при старте воспроизведения */
  function drum() {
    if (!on || !ensure()) return;
    const t = ctx.currentTime;
    [0, .12, .24, .3, .36, .48].forEach((dt, i) => {
      const n = noise(0.12), hp = ctx.createBiquadFilter(), g = ctx.createGain();
      hp.type = 'highpass'; hp.frequency.value = 1400;
      const s = t + dt, v = i === 5 ? 0.35 : 0.2;
      g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(v, s + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.1);
      n.connect(hp).connect(g).connect(ctx.destination); n.start(s); n.stop(s + 0.12);
    });
  }
  /* Озвучка текста (рассказчик) */
  let voice = null;
  function pickVoice() {
    if (!('speechSynthesis' in window)) return null;
    const vs = speechSynthesis.getVoices().filter(v => /^ru/i.test(v.lang));
    voice = vs.find(v => /milena|yuri|google|premium|enhanced/i.test(v.name)) || vs[0] || null;
    return voice;
  }
  if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  function speak(text, onend) {
    if (!on || !('speechSynthesis' in window) || !(voice || pickVoice())) return false;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice; u.lang = voice.lang; u.rate = 0.98; u.pitch = 0.95;
    u.onend = () => onend && onend(true);
    u.onerror = () => onend && onend(false);
    speechSynthesis.speak(u);
    return true;
  }
  const hush = () => { if ('speechSynthesis' in window) speechSynthesis.cancel(); };
  return {
    boom, rustle, bell, drum, speak, hush, unlock: ensure,
    get on() { return on; }, set on(v) { on = v; if (!v) hush(); },
    hasVoice: () => !!(voice || pickVoice())
  };
})();
