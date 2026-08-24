<script setup lang="ts">
import { useLoop } from "@tresjs/core";
import { CanvasTexture, SpriteMaterial, type Group, type Sprite } from "three";
import { onUnmounted, shallowRef, watch } from "vue";
import type { IncubatorRevealCode } from "../../types";
import { e3, v3 } from "../threeProps";
import { useIncubatorVisual } from "../visualState";

const visual = useIncubatorVisual();
const halfPi = Math.PI / 2;
const burst = shallowRef<Group | null>(null);
const glyph = shallowRef<Sprite | null>(null);
const canvas = document.createElement("canvas");
canvas.width = 512;
canvas.height = 512;
const texture = new CanvasTexture(canvas);
const spriteMat = new SpriteMaterial({
  map: texture,
  transparent: true,
  depthWrite: false,
  toneMapped: false,
  opacity: 0,
});
const rootPos = v3(0, 1.78, 0.18);
const glyphPos = v3(0, 0.05, 0.4);
const glyphScale = v3(1.2, 1.2, 1);
const ringTilt = e3(0.9, 0.4, 0.2);

function paintGlyph(code: IncubatorRevealCode | null) {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }
  ctx.clearRect(0, 0, 512, 512);
  if (!code) {
    texture.needsUpdate = true;
    return;
  }
  const fill = code === "0" ? "#05603C" : code === "1" ? "#8ABFA6" : "#FEFEFE";
  const outline = code === "M" ? "#011210" : "#000000";
  const fontSize = code === "M" ? 300 : 280;

  const halo = ctx.createRadialGradient(256, 256, 45, 256, 256, 210);
  halo.addColorStop(0, "rgba(1, 18, 16, 0.92)");
  halo.addColorStop(0.58, "rgba(1, 18, 16, 0.76)");
  halo.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, 512, 512);

  ctx.shadowColor = fill;
  ctx.shadowBlur = code === "M" ? 24 : 18;
  ctx.fillStyle = fill;
  ctx.strokeStyle = outline;
  ctx.lineWidth = code === "M" ? 24 : 18;
  ctx.lineJoin = "round";
  ctx.font = `800 ${fontSize}px 'Segoe UI', system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.strokeText(code, 256, 268);
  ctx.fillText(code, 256, 268);
  texture.needsUpdate = true;
}

watch(
  () => visual.revealCode,
  (code) => {
    paintGlyph(code);
  },
  { immediate: true },
);

const { onBeforeRender } = useLoop();

onBeforeRender(({ elapsed }) => {
  spriteMat.opacity = visual.glyphOpacity;
  if (glyph.value) {
    const base = visual.revealCode === "0" ? 1.02 + visual.revealPower * 0.18 : 1.2 + visual.revealPower * 0.38;
    glyph.value.scale.set(base, base, 1);
  }
  if (burst.value) {
    const s = Math.max(0.01, visual.revealPower);
    burst.value.scale.setScalar(s);
    burst.value.rotation.y = elapsed * (0.3 + (visual.revealCode === "M" ? 2.4 : 0.4));
    burst.value.visible = visual.revealPower > 0.02;
  }
});

onUnmounted(() => {
  spriteMat.dispose();
  texture.dispose();
});
</script>

<template>
  <TresGroup :position="rootPos">
    <TresSprite
      ref="glyph"
      :material="spriteMat"
      :position="glyphPos"
      :scale="glyphScale"
    />
    <TresGroup ref="burst">
      <TresMesh :rotation-x="halfPi">
        <TresTorusGeometry :args="[0.85, 0.018, 8, 64]" />
        <TresMeshStandardMaterial
          :color="`rgb(${Math.round(visual.tintR * 255)}, ${Math.round(visual.tintG * 255)}, ${Math.round(visual.tintB * 255)})`"
          :emissive="0xFEFEFE"
          :emissive-intensity="1.4"
        />
      </TresMesh>
      <TresMesh :rotation="ringTilt">
        <TresTorusGeometry :args="[1.15, 0.012, 8, 64]" />
        <TresMeshStandardMaterial
          color="#0FB576"
          :emissive="0x08995D"
          :emissive-intensity="0.9"
          :transparent="true"
          :opacity="0.7"
        />
      </TresMesh>
      <TresMesh>
        <TresIcosahedronGeometry :args="[0.55, 0]" />
        <TresMeshStandardMaterial
          color="#FEFEFE"
          :wireframe="true"
          :emissive="0x0FB576"
          :emissive-intensity="0.8"
          :transparent="true"
          :opacity="0.45"
        />
      </TresMesh>
    </TresGroup>
  </TresGroup>
</template>
