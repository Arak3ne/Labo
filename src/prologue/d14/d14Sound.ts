import { prefersReducedMotion } from "./config";

export type BedId = "idle" | "inside" | "tension" | "hold" | "kill";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let bedGain: GainNode | null = null;
let bedStops: Array<() => void> = [];
let currentBed: BedId | null = null;
let silenced = false;
let bedSeq = 0;

function able(): boolean {
  return typeof window !== "undefined" && !prefersReducedMotion();
}

function ac(): AudioContext | null {
  if (!able()) return null;
  try {
    if (!ctx) {
      ctx = new window.AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.62;
      master.connect(ctx.destination);
      bedGain = ctx.createGain();
      bedGain.gain.value = 0;
      const bedFilter = ctx.createBiquadFilter();
      bedFilter.type = "lowpass";
      bedFilter.frequency.value = 360;
      bedFilter.Q.value = 0.35;
      bedGain.connect(bedFilter);
      bedFilter.connect(master);
    }
    return ctx;
  } catch {
    return null;
  }
}

/** Premier geste joueur — obligatoire pour l’audio du navigateur. */
export function prime(): void {
  silenced = false;
  const context = ac();
  if (!context || !master) return;
  if (context.state === "suspended") void context.resume();
  master.gain.cancelScheduledValues(context.currentTime);
  master.gain.setValueAtTime(0.62, context.currentTime);
}

function noiseBuffer(context: AudioContext, seconds: number): AudioBuffer {
  const length = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function loopNoise(
  context: AudioContext,
  dest: AudioNode,
  volume: number,
  filterType: BiquadFilterType,
  freq: number,
): () => void {
  const src = context.createBufferSource();
  src.buffer = noiseBuffer(context, 1.8);
  src.loop = true;
  const filter = context.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = freq;
  const gain = context.createGain();
  gain.gain.value = volume;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  src.start();
  return () => {
    try {
      src.stop();
    } catch {
      /* already stopped */
    }
    src.disconnect();
    filter.disconnect();
    gain.disconnect();
  };
}

function loopOsc(
  context: AudioContext,
  dest: AudioNode,
  type: OscillatorType,
  hz: number,
  volume: number,
): () => void {
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = type;
  osc.frequency.value = hz;
  gain.gain.value = volume;
  osc.connect(gain);
  gain.connect(dest);
  osc.start();
  return () => {
    try {
      osc.stop();
    } catch {
      /* already stopped */
    }
    osc.disconnect();
    gain.disconnect();
  };
}

function stopBed(): void {
  for (const stop of bedStops) stop();
  bedStops = [];
  currentBed = null;
}

function fadeBed(to: number, seconds: number): void {
  if (!ctx || !bedGain) return;
  const now = ctx.currentTime;
  bedGain.gain.cancelScheduledValues(now);
  bedGain.gain.setValueAtTime(Math.max(0.0001, bedGain.gain.value), now);
  bedGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, to), now + seconds);
}

function buildBed(id: BedId, dest: AudioNode, context: AudioContext): void {
  if (id === "idle") {
    bedStops.push(loopOsc(context, dest, "sine", 36, 0.018));
    bedStops.push(loopNoise(context, dest, 0.006, "lowpass", 220));
    return;
  }
  if (id === "inside") {
    bedStops.push(loopOsc(context, dest, "sine", 48, 0.02));
    bedStops.push(loopOsc(context, dest, "sine", 96, 0.005));
    bedStops.push(loopNoise(context, dest, 0.005, "lowpass", 280));
    return;
  }
  if (id === "tension") {
    bedStops.push(loopOsc(context, dest, "sine", 42, 0.022));
    bedStops.push(loopNoise(context, dest, 0.01, "lowpass", 320));
    return;
  }
  if (id === "hold") {
    bedStops.push(loopOsc(context, dest, "sine", 40, 0.01));
    return;
  }
  bedStops.push(loopOsc(context, dest, "sine", 32, 0.024));
  bedStops.push(loopOsc(context, dest, "sine", 64, 0.006));
  bedStops.push(loopNoise(context, dest, 0.012, "lowpass", 380));
}

export function setBed(id: BedId | null, fadeSeconds = 0.45): void {
  if (silenced) return;
  const context = ac();
  if (!context || !bedGain) return;
  if (id === currentBed) return;
  const seq = (bedSeq += 1);
  fadeBed(0.0001, Math.min(0.25, fadeSeconds));
  globalThis.setTimeout(() => {
    if (silenced || seq !== bedSeq) return;
    stopBed();
    if (!id || !bedGain || !ctx) return;
    buildBed(id, bedGain, ctx);
    currentBed = id;
    fadeBed(0.42, fadeSeconds);
  }, 80);
}

export function tone(
  fromHz: number,
  toHz: number,
  seconds: number,
  volume: number,
  type: OscillatorType = "sine",
): void {
  if (silenced) return;
  const context = ac();
  if (!context || !master) return;
  const osc = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;
  osc.type = type;
  osc.frequency.setValueAtTime(fromHz, now);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, toHz), now + seconds);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
  osc.connect(gain);
  gain.connect(master);
  osc.start(now);
  osc.stop(now + seconds + 0.04);
}

export function noise(
  seconds: number,
  volume: number,
  freq: number,
  type: BiquadFilterType = "bandpass",
): void {
  if (silenced) return;
  const context = ac();
  if (!context || !master) return;
  const src = context.createBufferSource();
  src.buffer = noiseBuffer(context, seconds);
  const filter = context.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  const gain = context.createGain();
  const now = context.currentTime;
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  src.start(now);
  src.stop(now + seconds + 0.04);
}

export function tick(): void {
  tone(1900, 1400, 0.035, 0.05, "square");
  tone(140, 90, 0.05, 0.04, "sine");
}

export function deny(): void {
  tone(180, 70, 0.28, 0.07, "sawtooth");
  noise(0.18, 0.06, 400, "lowpass");
}

export function servo(): void {
  noise(0.55, 0.05, 1200, "bandpass");
  tone(220, 440, 0.4, 0.03, "triangle");
}

export function thud(): void {
  tone(90, 40, 0.16, 0.09, "sine");
  noise(0.08, 0.05, 200, "lowpass");
}

export function unlockChord(): void {
  tone(220, 220, 0.35, 0.05, "sine");
  tone(330, 330, 0.4, 0.035, "sine");
  tone(55, 55, 0.5, 0.04, "sine");
}

export function incident(): void {
  noise(0.14, 0.1, 1600);
  tone(420, 90, 0.18, 0.06, "sawtooth");
}

export function detectPing(): void {
  tone(880, 880, 0.06, 0.045, "sine");
  tone(440, 440, 0.12, 0.03, "sine");
}

export function alarmHit(): void {
  tone(880, 880, 0.1, 0.07, "square");
  globalThis.setTimeout(() => {
    tone(620, 620, 0.14, 0.08, "square");
  }, 130);
}

export function tear(): void {
  noise(0.1, 0.12, 1900);
  tone(260, 60, 0.09, 0.055, "sawtooth");
}

export function blow(): void {
  noise(0.14, 0.16, 3400, "highpass");
  tone(180, 40, 0.2, 0.06, "sine");
}

export function crtOff(): void {
  tone(720, 26, 0.85, 0.1, "sine");
  noise(0.4, 0.09, 800, "lowpass");
}

export function stutter(hits = 5): void {
  const context = ac();
  if (!context || !master || silenced) return;
  const now = context.currentTime;
  for (let i = 0; i < hits; i += 1) {
    const t = now + i * 0.07;
    master.gain.setValueAtTime(0.62, t);
    master.gain.setValueAtTime(0.0001, t + 0.025);
    master.gain.setValueAtTime(0.62, t + 0.05);
  }
}

export function hardCut(): void {
  silenced = true;
  const context = ac();
  if (context && master) {
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setValueAtTime(0, context.currentTime);
  }
  stopBed();
}

export function d07Mark(): void {
  silenced = false;
  prime();
  tone(1320, 1320, 0.04, 0.035, "square");
  globalThis.setTimeout(() => {
    const context = ac();
    if (context && master) {
      master.gain.setValueAtTime(0, context.currentTime + 0.08);
    }
    silenced = true;
    stopBed();
  }, 90);
}

export function shutdown(): void {
  hardCut();
  if (ctx && ctx.state !== "closed") {
    void ctx.close().catch(() => undefined);
  }
  ctx = null;
  master = null;
  bedGain = null;
}
