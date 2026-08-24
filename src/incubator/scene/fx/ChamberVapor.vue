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

const COUNT = 220;
const visual = useIncubatorVisual();
const root = shallowRef<Group | null>(null);
const geometry = new BufferGeometry();
const positions = new Float32Array(COUNT * 3);
const seeds = new Float32Array(COUNT);
const sides = new Float32Array(COUNT);

for (let i = 0; i < COUNT; i += 1) {
  const left = i < COUNT / 2;
  const angle = Math.random() * Math.PI * 2;
  const radius = 0.12 + Math.random() * 0.48;
  sides[i] = left ? -2.55 : 2.55;
  positions[i * 3] = sides[i] + Math.cos(angle) * radius;
  positions[i * 3 + 1] = 0.42 + Math.random() * 1.9;
  positions[i * 3 + 2] = Math.sin(angle) * radius;
  seeds[i] = Math.random();
}

geometry.setAttribute("position", new BufferAttribute(positions, 3));

const material = new PointsMaterial({
  color: 0x8abfa6,
  size: 0.045,
  transparent: true,
  opacity: 0,
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
  const density = (visual.vapor * 0.55 + visual.innerGlow * 0.18 + visual.analysis * 0.12) * (1 - visual.blackout);
  material.opacity = density;
  material.size = 0.038 + visual.vapor * 0.02 + visual.analysis * 0.012;
  const attr = geometry.getAttribute("position");
  const lift = 0.12 + visual.vapor * 0.28 + visual.analysis * 0.18;
  for (let i = 0; i < COUNT; i += 1) {
    let y = attr.getY(i) + delta * lift * (0.25 + seeds[i]);
    if (y > 2.35) {
      y = 0.4;
    }
    const swirl = delta * (0.12 + visual.analysis * 0.2);
    const x = attr.getX(i);
    const z = attr.getZ(i);
    attr.setX(i, x + (sides[i] - x) * delta * 0.08 + Math.sin(y * 4 + seeds[i] * 8) * swirl * 0.04);
    attr.setY(i, y);
    attr.setZ(i, z + Math.cos(y * 3.2 + seeds[i]) * swirl * 0.035);
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
