/* Синтезированные звуки удара/забивания: WebAudio, без файлов.
   Контекст создаётся лениво по жесту пользователя (политика браузеров). */

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Глухой стук: низкий тон + короткий шумовой всплеск. strength 0..1. */
export function knock(strength = 1): void {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;

  const osc = ac.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(70 + Math.random() * 50, t);
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.1);
  const oscGain = ac.createGain();
  oscGain.gain.setValueAtTime(0.5 * strength, t);
  oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
  osc.connect(oscGain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + 0.15);

  const noiseLen = 0.06;
  const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * noiseLen), ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
  }
  const noise = ac.createBufferSource();
  noise.buffer = buf;
  const noiseGain = ac.createGain();
  noiseGain.gain.setValueAtTime(0.25 * strength, t);
  noise.connect(noiseGain).connect(ac.destination);
  noise.start(t);
}

/** Мягкий «плюх» падения куска. */
export function thud(strength = 0.5): void {
  knock(strength * 0.5);
}
