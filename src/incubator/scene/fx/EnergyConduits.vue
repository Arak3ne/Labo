<script setup lang="ts">
import { useLoop } from "@tresjs/core";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Points,
  PointsMaterial,
  QuadraticBezierCurve3,
  TubeGeometry,
  Vector3,
  type Group,
} from "three";
import { onUnmounted, shallowRef } from "vue";
import { createEnergyMaterial } from "../materials/createEnergyMaterial";
import { useIncubatorVisual } from "../visualState";

const COUNT = 160;
const visual = useIncubatorVisual();
const root = shallowRef<Group | null>(null);
const leftGeom = new BufferGeometry();
const rightGeom = new BufferGeometry();
const leftPos = new Float32Array(COUNT * 3);
const rightPos = new Float32Array(COUNT * 3);
const leftSeeds = new Float32Array(COUNT);
const rightSeeds = new Float32Array(COUNT);

leftGeom.setAttribute("position", new BufferAttribute(leftPos, 3));
rightGeom.setAttribute("position", new BufferAttribute(rightPos, 3));

const leftMat = new PointsMaterial({
  color: 0x0fb576,
  size: 0.05,
  transparent: true,
  opacity: 0,
  depthWrite: false,
  blending: AdditiveBlending,
  sizeAttenuation: true,
});
const rightMat = leftMat.clone();
rightMat.color = new Color(0x8abfa6);

const startL = new Vector3(-2.55, 1.28, 0);
const startR = new Vector3(2.55, 1.28, 0);
const end = new Vector3(0, 1.72, 0);
const ctrlL = new Vector3(-1.15, 2.42, 0.62);
const ctrlR = new Vector3(1.15, 2.42, 0.62);
const ctrlL2 = new Vector3(-1.2, 0.95, -0.45);
const ctrlR2 = new Vector3(1.2, 0.95, -0.45);
const sample = new Vector3();
const leftTubeMat = createEnergyMaterial();
const rightTubeMat = createEnergyMaterial();
const leftReturnMat = createEnergyMaterial();
const rightReturnMat = createEnergyMaterial();
const leftTube = new TubeGeometry(new QuadraticBezierCurve3(startL, ctrlL, end), 40, 0.026, 7, false);
const rightTube = new TubeGeometry(new QuadraticBezierCurve3(startR, ctrlR, end), 40, 0.026, 7, false);
const leftReturn = new TubeGeometry(new QuadraticBezierCurve3(startL, ctrlL2, end), 36, 0.014, 6, false);
const rightReturn = new TubeGeometry(new QuadraticBezierCurve3(startR, ctrlR2, end), 36, 0.014, 6, false);

function curveAt(start: Vector3, ctrl: Vector3, t: number, target: Vector3) {
  const inv = 1 - t;
  target.set(
    inv * inv * start.x + 2 * inv * t * ctrl.x + t * t * end.x,
    inv * inv * start.y + 2 * inv * t * ctrl.y + t * t * end.y,
    inv * inv * start.z + 2 * inv * t * ctrl.z + t * t * end.z,
  );
}

for (let i = 0; i < COUNT; i += 1) {
  leftSeeds[i] = Math.random();
  rightSeeds[i] = Math.random();
}

let leftPoints: Points | null = null;
let rightPoints: Points | null = null;
let clock = 0;

const { onBeforeRender } = useLoop();

onBeforeRender(({ delta, elapsed }) => {
  if (root.value && !leftPoints) {
    leftPoints = new Points(leftGeom, leftMat);
    rightPoints = new Points(rightGeom, rightMat);
    root.value.add(leftPoints);
    root.value.add(rightPoints);
  }
  clock += delta;
  const live = 1 - visual.blackout;
  const flow = visual.energyFlow * live;
  const leftFlow = Math.max(flow, visual.leftFingerprintEnergy * 0.62) * live;
  const rightFlow = Math.max(flow, visual.rightFingerprintEnergy * 0.62) * live;
  leftMat.opacity = leftFlow * 0.82;
  rightMat.opacity = rightFlow * 0.82;
  leftMat.size = 0.042 + visual.analysis * 0.055 + visual.revealPower * 0.025 + flow * 0.035;
  rightMat.size = leftMat.size;
  leftMat.color.setRGB(visual.tintR, visual.tintG, visual.tintB);
  rightMat.color.setRGB(0.5412, 0.749, 0.651);
  leftTubeMat.uniforms.uTime.value = elapsed;
  rightTubeMat.uniforms.uTime.value = elapsed * 1.04;
  leftReturnMat.uniforms.uTime.value = elapsed * 1.15;
  rightReturnMat.uniforms.uTime.value = elapsed * 1.2;
  leftTubeMat.uniforms.uIntensity.value =
    0.025 + leftFlow * 1.55 + visual.analysis * 0.16 * live;
  rightTubeMat.uniforms.uIntensity.value =
    0.025 + rightFlow * 1.55 + visual.analysis * 0.16 * live;
  leftReturnMat.uniforms.uIntensity.value = 0.015 + leftFlow * 0.72;
  rightReturnMat.uniforms.uIntensity.value = 0.015 + rightFlow * 0.72;
  leftTubeMat.uniforms.uColorA.value.setRGB(
    visual.tintR,
    visual.tintG,
    visual.tintB,
  );
  leftReturnMat.uniforms.uColorA.value.setRGB(
    visual.tintR,
    visual.tintG,
    visual.tintB,
  );

  const leftAttr = leftGeom.getAttribute("position");
  const rightAttr = rightGeom.getAttribute("position");
  for (let i = 0; i < COUNT; i += 1) {
    const speed = 0.28 + flow * 1.05;
    const tL = (leftSeeds[i] + clock * speed) % 1;
    const tR = (rightSeeds[i] + clock * speed * 0.92) % 1;
    const ctrlA = i % 2 === 0 ? ctrlL2 : ctrlL;
    const ctrlB = i % 2 === 0 ? ctrlR2 : ctrlR;
    curveAt(startL, ctrlA, tL, sample);
    leftAttr.setXYZ(i, sample.x, sample.y, sample.z);
    curveAt(startR, ctrlB, tR, sample);
    rightAttr.setXYZ(i, sample.x, sample.y, sample.z);
  }
  leftAttr.needsUpdate = true;
  rightAttr.needsUpdate = true;
});

onUnmounted(() => {
  if (root.value) {
    if (leftPoints) {
      root.value.remove(leftPoints);
    }
    if (rightPoints) {
      root.value.remove(rightPoints);
    }
  }
  leftGeom.dispose();
  rightGeom.dispose();
  leftMat.dispose();
  rightMat.dispose();
  leftTube.dispose();
  rightTube.dispose();
  leftReturn.dispose();
  rightReturn.dispose();
  leftTubeMat.dispose();
  rightTubeMat.dispose();
  leftReturnMat.dispose();
  rightReturnMat.dispose();
});
</script>

<template>
  <TresGroup ref="root">
    <TresMesh
      :geometry="leftTube"
      :material="leftTubeMat"
    />
    <TresMesh
      :geometry="rightTube"
      :material="rightTubeMat"
    />
    <TresMesh
      :geometry="leftReturn"
      :material="leftReturnMat"
    />
    <TresMesh
      :geometry="rightReturn"
      :material="rightReturnMat"
    />
  </TresGroup>
</template>
