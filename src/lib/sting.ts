// Фирменный звук заставки — синтезируется в браузере через Web Audio, файлов нет.
// Структура: нарастание (шум + тон) → удар (бас) → металлический звон с мерцанием.
// Возвращает время удара в секундах от старта — под него синхронизируется анимация.

export const IMPACT_AT = 1.1;

/**
 * Играет звук. Без действия человека браузеры обычно не разрешают звук — тогда
 * аудиоконтекст создаётся «на паузе», и мы тихо отказываемся, чтобы звук не заиграл
 * позже, не в такт анимации.
 */
export type StingOptions = {
  /** Нарастание перед ударом (1,1 с). Без него удар звучит сразу — для «Дай пять». */
  riser?: boolean;
};

export function playSting(opts: StingOptions = {}): AudioContext | null {
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC();
  if (ctx.state !== 'running') {
    ctx.close();
    return null;
  }
  buildSting(ctx, ctx.currentTime + 0.03, opts);
  setTimeout(() => ctx.close(), (IMPACT_AT + 3.8) * 1000);
  return ctx;
}

/** Строит звук в любом аудиоконтексте — живом или офлайн (для проверки). */
export function buildSting(ctx: BaseAudioContext, t0: number, { riser = true }: StingOptions = {}) {
  const hit = riser ? t0 + IMPACT_AT : t0 + 0.01;

  const master = ctx.createGain();
  master.gain.value = 0.55;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);

  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.4, ctx.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  if (riser) {
    // 1. Нарастание: белый шум через полосовой фильтр, который раскрывается вверх
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(260, t0);
    bp.frequency.exponentialRampToValueAtTime(3200, hit);
    const riseGain = ctx.createGain();
    // слышно с первых мгновений и уверенно растёт к удару
    riseGain.gain.setValueAtTime(0.02, t0);
    riseGain.gain.linearRampToValueAtTime(0.12, t0 + IMPACT_AT * 0.6);
    riseGain.gain.linearRampToValueAtTime(0.5, hit - 0.04);
    riseGain.gain.exponentialRampToValueAtTime(0.0001, hit + 0.12);
    noise.connect(bp).connect(riseGain).connect(master);
    noise.start(t0);
    noise.stop(hit + 0.2);

    // тихий восходящий тон под шумом
    const glide = ctx.createOscillator();
    glide.type = 'sine';
    glide.frequency.setValueAtTime(196, t0);
    glide.frequency.exponentialRampToValueAtTime(392, hit);
    const glideGain = ctx.createGain();
    glideGain.gain.setValueAtTime(0.0001, t0);
    glideGain.gain.exponentialRampToValueAtTime(0.09, hit - 0.1);
    glideGain.gain.exponentialRampToValueAtTime(0.0001, hit + 0.05);
    glide.connect(glideGain).connect(master);
    glide.start(t0);
    glide.stop(hit + 0.1);
  } else {
    // «Хлопок ладоней»: короткий яркий всплеск шума прямо в момент касания
    const clap = ctx.createBufferSource();
    clap.buffer = noiseBuf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 900;
    const peak = ctx.createBiquadFilter();
    peak.type = 'peaking';
    peak.frequency.value = 2400;
    peak.gain.value = 8;
    const clapGain = ctx.createGain();
    clapGain.gain.setValueAtTime(0.0001, hit - 0.005);
    clapGain.gain.exponentialRampToValueAtTime(0.7, hit + 0.004);
    clapGain.gain.exponentialRampToValueAtTime(0.0001, hit + 0.075);
    clap.connect(hp).connect(peak).connect(clapGain).connect(master);
    clap.start(hit - 0.005);
    clap.stop(hit + 0.1);
  }

  // 2. Удар: бас с падением высоты + короткий щелчок
  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(92, hit);
  sub.frequency.exponentialRampToValueAtTime(38, hit + 0.45);
  const subGain = ctx.createGain();
  subGain.gain.setValueAtTime(0.0001, hit);
  subGain.gain.exponentialRampToValueAtTime(0.9, hit + 0.012);
  subGain.gain.exponentialRampToValueAtTime(0.0001, hit + 1.4);
  sub.connect(subGain).connect(master);
  sub.start(hit);
  sub.stop(hit + 1.5);

  const click = ctx.createBufferSource();
  click.buffer = noiseBuf;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1800;
  const clickGain = ctx.createGain();
  clickGain.gain.setValueAtTime(0.35, hit);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, hit + 0.09);
  click.connect(lp).connect(clickGain).connect(master);
  click.start(hit);
  click.stop(hit + 0.1);

  // 3. Звон: основной тон с мерцанием и негармонические обертоны — «металл»
  const tremolo = ctx.createOscillator();
  tremolo.frequency.value = 5.5;
  const tremoloDepth = ctx.createGain();
  tremoloDepth.gain.value = 0.25; // ±25% громкости основного тона
  tremolo.connect(tremoloDepth);
  tremolo.start(hit);
  tremolo.stop(hit + 3.4);

  const partials: [number, number, number][] = [
    // частота, громкость, длительность затухания
    [392, 0.22, 3.2],
    [588, 0.07, 2.4],
    [784, 0.05, 2.0],
    [1046, 0.045, 1.6],
    [1566, 0.03, 1.2],
    [2349, 0.02, 0.9],
    [3520, 0.012, 0.7],
  ];
  partials.forEach(([f, g, dur], i) => {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f * (1 + (i % 2 ? 0.002 : -0.002));
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, hit);
    og.gain.exponentialRampToValueAtTime(g, hit + 0.02);
    og.gain.exponentialRampToValueAtTime(0.0001, hit + dur);
    const pan = ctx.createStereoPanner();
    pan.pan.value = i === 0 ? 0 : i % 2 ? 0.35 : -0.35;
    if (i === 0) {
      // Мерцание — отдельным узлом поверх огибающей, чтобы тон всё равно затухал
      const trem = ctx.createGain();
      trem.gain.value = 0.75;
      tremoloDepth.connect(trem.gain);
      o.connect(trem).connect(og).connect(pan).connect(master);
    } else {
      o.connect(og).connect(pan).connect(master);
    }
    o.start(hit);
    o.stop(hit + dur + 0.1);
  });
}
