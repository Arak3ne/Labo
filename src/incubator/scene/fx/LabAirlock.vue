<script setup lang="ts">
import { useLoop } from "@tresjs/core";
import {
  CanvasTexture,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NormalBlending,
  SpriteMaterial,
  type Group,
  type Mesh,
  type PointLight,
  type Sprite,
} from "three";
import { onUnmounted, shallowRef, watch } from "vue";
import { createHoloMaterial } from "../materials/createHoloMaterial";
import { e3, v3 } from "../threeProps";
import { useIncubatorVisual } from "../visualState";

const emit = defineEmits<{
  interact: [event: { target: "threshold"; kind: "hover" | "click"; active?: boolean }];
}>();

const visual = useIncubatorVisual();
const rootGroup = shallowRef<Group | null>(null);
const mark = shallowRef<Sprite | null>(null);
const leftDoorMesh = shallowRef<Mesh | null>(null);
const rightDoorMesh = shallowRef<Mesh | null>(null);
const hitMesh = shallowRef<Mesh | null>(null);
const airlockLight = shallowRef<PointLight | null>(null);
const canvas = document.createElement("canvas");
canvas.width = 1024;
canvas.height = 256;
const texture = new CanvasTexture(canvas);
texture.premultiplyAlpha = true;
const markMaterial = new SpriteMaterial({
  map: texture,
  color: "#FEFEFE",
  transparent: true,
  depthTest: false,
  depthWrite: false,
  fog: false,
  toneMapped: false,
  blending: NormalBlending,
  opacity: 0,
});
const veil = createHoloMaterial(0x8abfa6, 0);
veil.fog = false;
veil.depthTest = false;
const postMat = new MeshStandardMaterial({
  color: 0x011210,
  emissive: 0x04452e,
  metalness: 0.94,
  roughness: 0.16,
});
const lintelMat = new MeshStandardMaterial({
  color: 0x03261e,
  emissive: 0x0fb576,
  metalness: 0.9,
  roughness: 0.15,
});
const sillMat = new MeshStandardMaterial({
  color: 0x011210,
  emissive: 0x04452e,
  metalness: 0.94,
  roughness: 0.18,
});
const bladeLeft = new MeshBasicMaterial({
  color: 0x0fb576,
  transparent: true,
  depthWrite: false,
  opacity: 0,
});
const bladeRight = new MeshBasicMaterial({
  color: 0x8abfa6,
  transparent: true,
  depthWrite: false,
  opacity: 0,
});
const darkMat = new MeshBasicMaterial({
  color: 0x000000,
  transparent: true,
  depthWrite: false,
  opacity: 0,
});
const railLeft = new MeshBasicMaterial({
  color: 0x0fb576,
  transparent: true,
  depthWrite: false,
  opacity: 0,
});
const railRight = new MeshBasicMaterial({
  color: 0x8abfa6,
  transparent: true,
  depthWrite: false,
  opacity: 0,
});
const chevronMat = new MeshBasicMaterial({
  color: 0xfefefe,
  transparent: true,
  depthWrite: false,
  opacity: 0,
});
const hitMat = new MeshBasicMaterial({
  transparent: true,
  opacity: 0,
  depthWrite: false,
});
const liveMaterials = [
  postMat,
  lintelMat,
  sillMat,
  bladeLeft,
  bladeRight,
  darkMat,
  railLeft,
  railRight,
  chevronMat,
  hitMat,
];
const rootPos = v3(0, 1.82, 6.55);
const markPos = v3(0, 2.22, 0.16);
const markScale = v3(3.15, 0.78, 1);
const leftDoor = v3(-0.86, 0.08, 0);
const rightDoor = v3(0.86, 0.08, 0);
const leftPost = v3(-1.84, 0.08, 0);
const rightPost = v3(1.84, 0.08, 0);
const leftBlade = v3(-1.84, 0.08, 0.16);
const rightBlade = v3(1.84, 0.08, 0.16);
const lintelPos = v3(0, 2.28, 0);
const sillPos = v3(0, -1.78, 0.04);
const leftWing = v3(-2.22, 0.08, -0.18);
const rightWing = v3(2.22, 0.08, -0.18);
const darkPos = v3(0, 0.08, -0.22);
const lightPos = v3(0, 0.28, 0.42);
const leftRail = v3(-0.92, -1.76, 0.55);
const rightRail = v3(0.92, -1.76, 0.55);
const chevronPos = v3(0, -1.74, 0.92);
const floorRot = e3(-Math.PI / 2, 0, 0);
const hitPos = v3(0, 0.1, 0.18);

function paintMark() {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(1, 8, 7, 0.82)";
  ctx.fillRect(96, 36, 832, 188);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "#FEFEFE";
  ctx.font = "800 124px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText("SAS", 512, 102);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#FEFEFE";
  ctx.font = "700 34px 'Segoe UI', system-ui, sans-serif";
  ctx.fillText("SEUIL D’ACCÈS · FRANCHIR", 512, 196);
  texture.needsUpdate = true;
}

paintMark();

watch(rootGroup, (group) => {
  if (group) group.visible = false;
});

const { onBeforeRender } = useLoop();

onBeforeRender(({ elapsed }) => {
  const presence = visual.airlockPresence;
  const open = visual.airlockOpen;
  const live = presence * (1 - open * 0.92);
  const pulse = 0.86 + Math.sin(elapsed * 2.2) * 0.14 * live;
  markMaterial.opacity = Math.min(1, live * pulse);
  veil.uniforms.uTime.value = elapsed;
  veil.uniforms.uScan.value = visual.diagnosticScan;
  veil.uniforms.uOpacity.value = live * 1.22;
  postMat.emissiveIntensity = 0.14 + presence * 0.42;
  lintelMat.emissiveIntensity = 0.1 + presence * 0.38;
  sillMat.emissiveIntensity = 0.08 + presence * 0.22;
  const bladeOp = 0.18 + presence * 0.55;
  bladeLeft.opacity = bladeOp;
  bladeRight.opacity = bladeOp;
  darkMat.opacity = 0.78 * presence * (1 - open);
  const railOp = 0.22 + presence * 0.62;
  railLeft.opacity = railOp;
  railRight.opacity = railOp;
  chevronMat.opacity = 0.18 + presence * 0.55;
  if (rootGroup.value) rootGroup.value.visible = presence > 0.04;
  if (mark.value) mark.value.visible = live > 0.02;
  if (leftDoorMesh.value) leftDoorMesh.value.position.x = -0.86 - open * 1.72;
  if (rightDoorMesh.value) rightDoorMesh.value.position.x = 0.86 + open * 1.72;
  if (hitMesh.value) hitMesh.value.visible = presence > 0.35 && open < 0.2;
  if (airlockLight.value) airlockLight.value.intensity = 1.7 * presence * (1 - open);
});

function onHover(active: boolean) {
  if (visual.airlockPresence < 0.35 || visual.airlockOpen > 0.2) return;
  document.body.style.cursor = active ? "pointer" : "";
  emit("interact", { target: "threshold", kind: "hover", active });
}

function onClick() {
  if (visual.airlockPresence < 0.35 || visual.airlockOpen > 0.2) return;
  emit("interact", { target: "threshold", kind: "click" });
}

onUnmounted(() => {
  markMaterial.dispose();
  texture.dispose();
  veil.dispose();
  for (const material of liveMaterials) material.dispose();
  document.body.style.cursor = "";
});
</script>

<template>
  <TresGroup
    ref="rootGroup"
    :position="rootPos"
  >
    <TresMesh
      :position="leftPost"
      :material="postMat"
      :cast-shadow="true"
    >
      <TresBoxGeometry :args="[0.22, 3.92, 0.38]" />
    </TresMesh>
    <TresMesh
      :position="rightPost"
      :material="postMat"
      :cast-shadow="true"
    >
      <TresBoxGeometry :args="[0.22, 3.92, 0.38]" />
    </TresMesh>
    <TresMesh
      :position="leftBlade"
      :material="bladeLeft"
    >
      <TresBoxGeometry :args="[0.035, 3.55, 0.04]" />
    </TresMesh>
    <TresMesh
      :position="rightBlade"
      :material="bladeRight"
    >
      <TresBoxGeometry :args="[0.035, 3.55, 0.04]" />
    </TresMesh>
    <TresMesh
      :position="leftWing"
      :cast-shadow="true"
    >
      <TresBoxGeometry :args="[0.55, 3.7, 0.12]" />
      <TresMeshStandardMaterial
        color="#011210"
        :metalness="0.92"
        :roughness="0.22"
      />
    </TresMesh>
    <TresMesh
      :position="rightWing"
      :cast-shadow="true"
    >
      <TresBoxGeometry :args="[0.55, 3.7, 0.12]" />
      <TresMeshStandardMaterial
        color="#011210"
        :metalness="0.92"
        :roughness="0.22"
      />
    </TresMesh>
    <TresMesh
      :position="lintelPos"
      :material="lintelMat"
      :cast-shadow="true"
    >
      <TresBoxGeometry :args="[4.05, 0.18, 0.34]" />
    </TresMesh>
    <TresMesh
      :position="sillPos"
      :material="sillMat"
    >
      <TresBoxGeometry :args="[3.85, 0.14, 0.58]" />
    </TresMesh>
    <TresMesh
      :position="darkPos"
      :material="darkMat"
    >
      <TresBoxGeometry :args="[3.28, 3.48, 0.08]" />
    </TresMesh>
    <TresMesh
      ref="leftDoorMesh"
      :position="leftDoor"
      :material="veil"
      :render-order="36"
    >
      <TresBoxGeometry :args="[1.68, 3.42, 0.05]" />
    </TresMesh>
    <TresMesh
      ref="rightDoorMesh"
      :position="rightDoor"
      :material="veil"
      :render-order="36"
    >
      <TresBoxGeometry :args="[1.68, 3.42, 0.05]" />
    </TresMesh>
    <TresMesh
      :position="leftRail"
      :rotation="floorRot"
      :material="railLeft"
    >
      <TresBoxGeometry :args="[0.08, 1.35, 0.02]" />
    </TresMesh>
    <TresMesh
      :position="rightRail"
      :rotation="floorRot"
      :material="railRight"
    >
      <TresBoxGeometry :args="[0.08, 1.35, 0.02]" />
    </TresMesh>
    <TresMesh
      :position="chevronPos"
      :rotation="floorRot"
      :material="chevronMat"
    >
      <TresBoxGeometry :args="[0.42, 0.18, 0.02]" />
    </TresMesh>
    <TresSprite
      ref="mark"
      :material="markMaterial"
      :position="markPos"
      :scale="markScale"
      :render-order="44"
    />
    <TresMesh
      ref="hitMesh"
      :position="hitPos"
      :material="hitMat"
      @click="onClick"
      @pointerenter="onHover(true)"
      @pointerleave="onHover(false)"
    >
      <TresPlaneGeometry :args="[3.45, 3.7]" />
    </TresMesh>
    <TresPointLight
      ref="airlockLight"
      :position="lightPos"
      color="#8ABFA6"
      :intensity="0"
      :distance="7.8"
      :decay="2"
    />
  </TresGroup>
</template>
