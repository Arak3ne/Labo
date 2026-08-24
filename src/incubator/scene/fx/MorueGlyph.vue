<script setup lang="ts">
import { useLoop } from "@tresjs/core";
import {
  AdditiveBlending,
  CanvasTexture,
  SpriteMaterial,
  type Mesh,
  type Sprite,
} from "three";
import { onUnmounted, shallowRef } from "vue";
import { createEnergyMaterial } from "../materials/createEnergyMaterial";
import { createHoloMaterial } from "../materials/createHoloMaterial";
import { v3 } from "../threeProps";
import { useIncubatorVisual } from "../visualState";

const WORD = "M.O.R.U.E.";
const TYPE_DELAYS = [0.32, 0.28, 0.1, 0.22, 0.09, 0.24, 0.09, 0.22, 0.1, 0.26, 0.12];
const visual = useIncubatorVisual();
const glyph = shallowRef<Sprite | null>(null);
const ghost = shallowRef<Sprite | null>(null);
const ringA = shallowRef<Mesh | null>(null);
const ringB = shallowRef<Mesh | null>(null);
const canvas = document.createElement("canvas");
canvas.width = 2048;
canvas.height = 512;
const texture = new CanvasTexture(canvas);
texture.premultiplyAlpha = true;
const material = new SpriteMaterial({
  map: texture,
  color: "#B7FFD8",
  transparent: true,
  depthTest: false,
  depthWrite: false,
  fog: false,
  toneMapped: false,
  blending: AdditiveBlending,
  opacity: 0,
});
const ghostMaterial = material.clone();
ghostMaterial.opacity = 0;
const panel = createHoloMaterial(0x0fb576, 0);
panel.fog = false;
panel.depthTest = false;
const ring = createEnergyMaterial();
ring.fog = false;
ring.depthTest = false;
const rootPos = v3(0.82, 1.78, 0.12);
const ghostPos = v3(0.86, 1.82, 0.02);
const panelPos = v3(0.82, 1.76, -0.08);
const ringAPos = v3(0.82, 1.76, 0.18);
const ringBPos = v3(0.82, 1.76, 0.18);
const lightPos = v3(0.7, 1.9, 1.1);
const glyphScale = v3(5.35, 1.34, 1);
const panelScale = v3(6.4, 2.15, 1);
const ringBScale = v3(1.28, 1.28, 1.28);
const holoLight = shallowRef<{ intensity: number } | null>(null);
const reducedMotion = typeof matchMedia === "function"
  && matchMedia("(prefers-reduced-motion: reduce)").matches;
let typeOrigin = -1;
let paintedKey = "";

function typedCount(elapsed: number, presence: number) {
  if (presence < 0.12) {
    typeOrigin = -1;
    return 0;
  }
  if (reducedMotion) return WORD.length;
  if (typeOrigin < 0) typeOrigin = elapsed;
  const local = elapsed - typeOrigin;
  let count = 0;
  let mark = 0;
  for (const delay of TYPE_DELAYS) {
    mark += delay;
    if (local < mark) break;
    count += 1;
  }
  return Math.min(WORD.length, count);
}

function paintWordmark(visible: string, caret: boolean) {
  const key = `${visible}|${caret ? "1" : "0"}`;
  if (key === paintedKey) return;
  paintedKey = key;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = "600 196px 'Segoe UI', system-ui, sans-serif";
  const originX = 1024 - ctx.measureText(WORD).width * 0.5;
  if (visible) {
    ctx.shadowColor = "rgba(15, 181, 118, 0.85)";
    ctx.shadowBlur = 28;
    ctx.strokeStyle = "rgba(138, 191, 166, 0.55)";
    ctx.lineWidth = 3;
    ctx.strokeText(visible, originX, 258);
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#F4FFF8";
    ctx.fillText(visible, originX, 258);
  }
  if (caret) {
    const caretX = originX + ctx.measureText(visible).width + 10;
    ctx.shadowBlur = 8;
    ctx.fillStyle = "#B7FFD8";
    ctx.fillRect(caretX, 168, 18, 178);
  }
  texture.needsUpdate = true;
}

paintWordmark("", false);

const { onBeforeRender } = useLoop();

onBeforeRender(({ elapsed }) => {
  const presence = visual.moruePresence;
  const live = presence > 0.02;
  const typed = typedCount(elapsed, presence);
  const visible = WORD.slice(0, typed);
  const typing = typed < WORD.length;
  const caret = live && (typing ? Math.sin(elapsed * 14) > 0 : Math.sin(elapsed * 3.4) > 0.65);
  paintWordmark(visible, caret && typed > 0);
  const breathe = 1 + Math.sin(elapsed * 1.45) * 0.028 * presence;
  const drift = Math.sin(elapsed * 0.72) * 0.05 * presence;
  const flicker = typing && Math.sin(elapsed * 28) > 0.82 ? 0.72 : 1;
  const pulse = 0.86 + Math.sin(elapsed * 2.4) * 0.08 * presence;
  material.opacity = Math.min(1, presence * pulse * flicker);
  ghostMaterial.opacity = presence * (typing ? 0.12 : 0.22);
  panel.uniforms.uTime.value = elapsed;
  panel.uniforms.uScan.value = 0.2 + visual.diagnosticScan * 0.8;
  panel.uniforms.uOpacity.value = presence * 0.55;
  ring.uniforms.uTime.value = elapsed;
  ring.uniforms.uIntensity.value = 0.22 + presence * 0.72 + visual.diagnosticScan * 0.35;
  if (holoLight.value) holoLight.value.intensity = 1.35 * presence;
  if (glyph.value) {
    glyph.value.visible = live;
    glyph.value.position.set(rootPos.x, rootPos.y + drift, rootPos.z);
    glyph.value.scale.set(glyphScale.x * breathe, glyphScale.y * breathe, 1);
  }
  if (ghost.value) {
    ghost.value.visible = live;
    ghost.value.position.set(ghostPos.x + Math.sin(elapsed * 3.1) * 0.04, ghostPos.y + drift * 0.6, ghostPos.z);
    ghost.value.scale.set(glyphScale.x * (breathe + 0.06), glyphScale.y * (breathe + 0.08), 1);
  }
  if (ringA.value) {
    ringA.value.visible = live;
    ringA.value.rotation.z = elapsed * 0.35;
    ringA.value.rotation.x = 1.22 + Math.sin(elapsed * 0.4) * 0.08;
  }
  if (ringB.value) {
    ringB.value.visible = live;
    ringB.value.rotation.z = -elapsed * 0.22;
    ringB.value.rotation.x = 1.05 - Math.sin(elapsed * 0.32) * 0.06;
  }
});

onUnmounted(() => {
  material.dispose();
  ghostMaterial.dispose();
  texture.dispose();
  panel.dispose();
  ring.dispose();
});
</script>

<template>
  <TresGroup>
    <TresMesh
      :position="panelPos"
      :material="panel"
      :scale="panelScale"
      :render-order="20"
    >
      <TresPlaneGeometry :args="[1, 1]" />
    </TresMesh>
    <TresMesh
      ref="ringA"
      :position="ringAPos"
      :material="ring"
      :rotation-x="1.22"
      :render-order="21"
    >
      <TresTorusGeometry :args="[1.85, 0.012, 8, 96]" />
    </TresMesh>
    <TresMesh
      ref="ringB"
      :position="ringBPos"
      :material="ring"
      :rotation-x="1.05"
      :scale="ringBScale"
      :render-order="21"
    >
      <TresTorusGeometry :args="[1.85, 0.008, 8, 96]" />
    </TresMesh>
    <TresSprite
      ref="ghost"
      :material="ghostMaterial"
      :position="ghostPos"
      :scale="glyphScale"
      :render-order="24"
    />
    <TresSprite
      ref="glyph"
      :material="material"
      :position="rootPos"
      :scale="glyphScale"
      :render-order="26"
    />
    <TresPointLight
      ref="holoLight"
      :position="lightPos"
      color="#0FB576"
      :intensity="0"
      :distance="9"
      :decay="2"
    />
  </TresGroup>
</template>
