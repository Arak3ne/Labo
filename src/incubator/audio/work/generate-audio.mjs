import { Buffer } from "node:buffer";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLE_RATE = 44_100;
const GAP = 0.08;
const TAU = Math.PI * 2;
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const output = resolve(root, "public/incubator/audio/incubator-sprite.wav");

const clips = [
  ["idle", 8],
  ["focusLeft", 0.32],
  ["focusRight", 0.32],
  ["loadSubjects", 1.65],
  ["chamberLock", 0.95],
  ["scan", 1.5],
  ["startAnalysis", 1.15],
  ["analysisLoop", 4],
  ["blackout", 0.22],
  ["reveal0", 0.8],
  ["reveal1", 1.1],
  ["revealM", 2.8],
  ["reset", 1.2],
];

const sprite = {};
let cursor = 0;
for (const [name, duration] of clips) {
  sprite[name] = [Math.round(cursor * 1000), Math.round(duration * 1000)];
  cursor += duration + GAP;
}

const samples = new Float64Array(Math.ceil(cursor * SAMPLE_RATE));
let seed = 0x5eed1234;
function noise() {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return ((seed >>> 0) / 0xffffffff) * 2 - 1;
}

function smoothstep(value) {
  const x = Math.max(0, Math.min(1, value));
  return x * x * (3 - 2 * x);
}

function env(t, duration, attack = 0.01, release = 0.12) {
  return smoothstep(t / attack) * smoothstep((duration - t) / release);
}

function add(name, generator, gain = 1) {
  const [offsetMs, durationMs] = sprite[name];
  const offset = Math.round(offsetMs * SAMPLE_RATE / 1000);
  const duration = durationMs / 1000;
  const count = Math.round(duration * SAMPLE_RATE);
  let lowNoise = 0;
  for (let index = 0; index < count; index += 1) {
    const t = index / SAMPLE_RATE;
    lowNoise += (noise() - lowNoise) * 0.012;
    samples[offset + index] += generator(t, duration, lowNoise, noise()) * gain;
  }
}

function sine(frequency, t, phase = 0) {
  return Math.sin(TAU * frequency * t + phase);
}

function chirp(start, end, t, duration) {
  const slope = (end - start) / duration;
  return Math.sin(TAU * (start * t + 0.5 * slope * t * t));
}

function pulseAt(t, at, decay) {
  return t < at ? 0 : Math.exp(-(t - at) * decay);
}

function resonantHit(t, at, frequency, decay, phase = 0) {
  return sine(frequency, t - at, phase) * pulseAt(t, at, decay);
}

// Seamless eight-second machine room tone. Every oscillator and modulation
// completes an integer number of cycles, so the loop boundary is click-free.
add("idle", (t) => (
  sine(30, t) * 0.22
  + sine(45, t, 0.7) * 0.075
  + sine(60, t, 1.2) * 0.035
  + sine(0.25, t) * sine(90, t) * 0.012
), 0.38);

add("focusLeft", (t, d) => (
  (sine(68, t) * 0.34 + sine(136, t, 0.4) * 0.08) * Math.exp(-t * 18)
) * env(t, d, 0.003, 0.09), 0.46);
add("focusRight", (t, d) => (
  (sine(72, t) * 0.32 + sine(144, t, 0.4) * 0.075) * Math.exp(-t * 18)
) * env(t, d, 0.003, 0.09), 0.46);

add("loadSubjects", (t, d, lowNoise, whiteNoise) => {
  const travel = smoothstep(t / 0.28) * smoothstep((d - t) / 0.34);
  const motor = chirp(37, 58, t, d) * (0.23 + 0.14 * Math.abs(sine(11, t)));
  const servo = sine(118, t) * Math.pow(Math.max(0, sine(17, t)), 6) * 0.1;
  const rail = (lowNoise * 0.22 + whiteNoise * 0.018) * travel;
  const endStop = resonantHit(t, 1.23, 46, 8) * 0.55 + resonantHit(t, 1.23, 91, 13) * 0.16;
  const pressure = t > 1.28 ? lowNoise * pulseAt(t, 1.28, 5.5) * 0.24 : 0;
  return ((motor + servo) * travel + rail + endStop + pressure) * env(t, d, 0.025, 0.16);
}, 0.72);

add("chamberLock", (t, d, lowNoise, whiteNoise) => {
  const servoWindow = smoothstep(t / 0.035) * smoothstep((0.43 - t) / 0.08);
  const servo = (sine(84, t) * 0.24 + sine(168, t) * 0.055 + lowNoise * 0.1) * servoWindow;
  const bolt = resonantHit(t, 0.43, 43, 8.5) * 0.78
    + resonantHit(t, 0.43, 86, 13) * 0.24
    + resonantHit(t, 0.43, 131, 19) * 0.1;
  const metal = whiteNoise * pulseAt(t, 0.43, 22) * 0.11;
  const pneumatic = lowNoise * pulseAt(t, 0.49, 5.5) * 0.32;
  return (servo + bolt + metal + pneumatic) * env(t, d, 0.004, 0.12);
}, 0.82);

add("scan", (t, d, lowNoise, whiteNoise) => {
  const window = env(t, d, 0.06, 0.16);
  const electromagnetic = sine(186, t + sine(0.7, t) * 0.0009) * 0.075
    + sine(279, t, 0.8) * 0.035;
  const narrowTexture = (lowNoise * 0.2 + whiteNoise * 0.018)
    * (0.48 + 0.52 * Math.abs(sine(3.25, t)));
  const carriage = sine(52, t) * 0.055 * smoothstep(t / 0.3);
  return (electromagnetic + narrowTexture + carriage) * window;
}, 0.58);

add("startAnalysis", (t, d, lowNoise) => {
  const breaker = resonantHit(t, 0.035, 48, 11) * 0.48 + lowNoise * pulseAt(t, 0.035, 16) * 0.16;
  const power = chirp(31, 47, t, d) * 0.3 * smoothstep(t / 0.42);
  const cabinet = sine(94, t) * 0.045 * smoothstep(t / 0.58);
  return (breaker + power + cabinet) * env(t, d, 0.004, 0.16);
}, 0.62);

// Four-second loop: deep electrical hum, cabinet vibration and a restrained
// commutator rhythm. Playback-rate automation supplies the acceleration.
add("analysisLoop", (t) => {
  const load = 0.68 + Math.pow(Math.max(0, sine(1.5, t)), 6) * 0.32;
  return (
    sine(31.5, t) * 0.32
    + sine(47.25, t, 0.45) * 0.13
    + sine(94.5, t, 1.1) * 0.035
    + sine(126, t) * Math.pow(Math.max(0, sine(3, t)), 8) * 0.025
  ) * load;
}, 0.6);

add("blackout", (t, d, lowNoise, whiteNoise) => {
  const trip = resonantHit(t, 0.008, 41, 28) * 0.48 + whiteNoise * pulseAt(t, 0.008, 38) * 0.1;
  const collapse = chirp(73, 29, t, d) * Math.exp(-t * 20) * 0.24;
  return (trip + collapse + lowNoise * Math.exp(-t * 28) * 0.08) * env(t, d, 0.001, 0.055);
}, 0.66);

add("reveal0", (t, d, lowNoise, whiteNoise) => {
  const dryImpact = resonantHit(t, 0.025, 57, 13) * 0.5
    + resonantHit(t, 0.025, 103, 20) * 0.12
    + whiteNoise * pulseAt(t, 0.025, 35) * 0.08;
  const discharge = lowNoise * pulseAt(t, 0.11, 9) * 0.13;
  return (dryImpact + discharge) * env(t, d, 0.002, 0.12);
}, 0.64);

add("reveal1", (t, d, lowNoise, whiteNoise) => {
  const preciseImpact = resonantHit(t, 0.025, 61, 14) * 0.5
    + resonantHit(t, 0.025, 122, 23) * 0.13
    + whiteNoise * pulseAt(t, 0.025, 42) * 0.07;
  const controlledResponse = sine(183, t) * pulseAt(t, 0.13, 8.5) * 0.09;
  const relay = resonantHit(t, 0.29, 76, 24) * 0.11;
  const current = lowNoise * pulseAt(t, 0.1, 7) * 0.09;
  return (preciseImpact + controlledResponse + relay + current) * env(t, d, 0.002, 0.16);
}, 0.68);

add("revealM", (t, d, lowNoise, whiteNoise) => {
  const impact = pulseAt(t, 0.02, 4.3);
  const machineResponse = smoothstep(t / 0.16) * smoothstep((d - t) / 0.75);
  const pressure = lowNoise * pulseAt(t, 0.08, 1.45) * 0.2;
  const metal = whiteNoise * pulseAt(t, 0.025, 21) * 0.11;
  return (
    sine(30, t) * impact * 0.78
    + sine(45, t, 0.35) * machineResponse * 0.28
    + sine(75, t, 1.1) * machineResponse * 0.09
    + sine(112, t) * machineResponse * 0.025
    + pressure
    + metal
  ) * env(t, d, 0.003, 0.34);
}, 0.82);

add("reset", (t, d, lowNoise, whiteNoise) => {
  const motorDown = chirp(58, 32, t, d) * 0.24;
  const vent = (lowNoise * 0.24 + whiteNoise * 0.022) * Math.exp(-t * 2.3);
  const landing = resonantHit(t, 0.72, 44, 9) * 0.3;
  return (motorDown + vent + landing) * env(t, d, 0.015, 0.2);
}, 0.54);

let peak = 0;
for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
// Leave summing headroom: startAnalysis, lock and scan intentionally overlap.
const targetPeak = 10 ** (-3 / 20);
const normalize = peak > 0 ? targetPeak / peak : 1;
const pcm = Buffer.alloc(samples.length * 2);
for (let index = 0; index < samples.length; index += 1) {
  const value = Math.max(-1, Math.min(1, samples[index] * normalize));
  pcm.writeInt16LE(Math.round(value * 32767), index * 2);
}

const wav = Buffer.alloc(44 + pcm.length);
wav.write("RIFF", 0);
wav.writeUInt32LE(36 + pcm.length, 4);
wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(SAMPLE_RATE, 24);
wav.writeUInt32LE(SAMPLE_RATE * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36);
wav.writeUInt32LE(pcm.length, 40);
pcm.copy(wav, 44);

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, wav);
writeFileSync(resolve(dirname(output), "incubator-sprite.json"), `${JSON.stringify(sprite, null, 2)}\n`);
console.log(`Generated ${output} (${(wav.length / 1024 / 1024).toFixed(2)} MiB, peak normalized to -3 dBFS)`);
