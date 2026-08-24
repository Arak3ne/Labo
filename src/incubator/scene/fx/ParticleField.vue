<script setup lang="ts">
import { useLoop } from "@tresjs/core";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Points,
  PointsMaterial,
  type Group,
} from "three";
import { onUnmounted, shallowRef } from "vue";
import { useIncubatorVisual } from "../visualState";

const COUNT = 1400;
const visual = useIncubatorVisual();
const root = shallowRef<Group | null>(null);
const seeds = new Float32Array(COUNT);
const geometry = new BufferGeometry();
const positions = new Float32Array(COUNT * 3);

for (let i = 0; i < COUNT; i += 1) {
  const angle = Math.random() * Math.PI * 2;
  const radius = 1.1 + Math.random() * 8.2;
  positions[i * 3] = Math.cos(angle) * radius;
  positions[i * 3 + 1] = Math.random() * 5.6;
  positions[i * 3 + 2] = Math.sin(angle) * radius;
  seeds[i] = Math.random();
}

geometry.setAttribute("position", new BufferAttribute(positions, 3));

const material = new PointsMaterial({
  color: 0x8abfa6,
  size: 0.03,
  transparent: true,
  opacity: 0.42,
  depthWrite: false,
  blending: AdditiveBlending,
  sizeAttenuation: true,
});

let points: Points | null = null;

const { onBeforeRender } = useLoop();

onBeforeRender(({ delta }) => {
  if (!points && root.value) {
    points = new Points(geometry, material);
    root.value.add(points);
  }
  material.opacity = (0.09 + visual.analysis * 0.22 + visual.revealPower * 0.2 + visual.subjectPresence * 0.08) * (1 - visual.blackout);
  material.size = 0.02 + visual.revealPower * 0.022 + visual.energyFlow * 0.008;
  material.color.setRGB(visual.tintR, visual.tintG, visual.tintB);
  const attr = geometry.getAttribute("position");
  const lift = 0.16 + visual.analysis * 0.75 + visual.revealPower * 0.4;
  const pull = visual.energyFlow * 0.55;
  for (let i = 0; i < COUNT; i += 1) {
    const x = attr.getX(i);
    const z = attr.getZ(i);
    let y = attr.getY(i) + delta * lift * (0.35 + seeds[i]);
    y = y > 5.8 ? 0.04 : y;
    attr.setX(i, x + (0 - x) * delta * pull * 0.35);
    attr.setY(i, y);
    attr.setZ(i, z + (0 - z) * delta * pull * 0.35);
  }
  attr.needsUpdate = true;
});

onUnmounted(() => {
  if (points && root.value) {
    root.value.remove(points);
  }
  geometry.dispose();
  material.dispose();
});
</script>

<template>
  <TresGroup ref="root" />
</template>
