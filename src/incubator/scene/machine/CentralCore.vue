<script setup lang="ts">
import { useLoop } from "@tresjs/core";
import { Color, type Group, type Mesh } from "three";
import { onUnmounted, shallowRef } from "vue";
import { createEnergyMaterial } from "../materials/createEnergyMaterial";
import { e3, v3 } from "../threeProps";
import { useIncubatorVisual } from "../visualState";

const visual = useIncubatorVisual();
const energyMat = createEnergyMaterial();
const ghostMat = createEnergyMaterial();
const shell = shallowRef<Mesh | null>(null);
const nucleus = shallowRef<Group | null>(null);
const haloA = shallowRef<Group | null>(null);
const haloB = shallowRef<Group | null>(null);
const tint = new Color();
const ice = new Color("#FEFEFE");
const rootPos = v3(0, 1.72, 0);
const columnPos = v3(0, -1.18, 0);
const collarPos = v3(0, -0.52, 0);
const stemPos = v3(0, 0.92, 0);
const capPos = v3(0, -1.72, 0);
const haloTilt = e3(1.15, 0.35, 0.2);
const ghostScale = v3(1.22, 1.22, 1.22);
const innerScale = v3(0.52, 0.52, 0.52);
const wireScale = v3(1.28, 1.28, 1.28);
const halfPi = Math.PI / 2;

const { onBeforeRender } = useLoop();

onBeforeRender(({ elapsed, delta }) => {
  const live = 1 - visual.blackout;
  const beat = Math.sin(elapsed * (1.65 + visual.analysis * 5.1 + visual.pulse * 1.4));
  const surge = Math.sin(elapsed * (4.8 + visual.analysis * 7.4)) * visual.energyFlow * 0.035;
  const pulse = 1 + beat * (0.018 + visual.coreEnergy * 0.048 + visual.analysis * 0.018) + surge;
  energyMat.uniforms.uTime.value = elapsed;
  ghostMat.uniforms.uTime.value = elapsed * 0.72;
  energyMat.uniforms.uIntensity.value =
    (0.1 + visual.coreEnergy * 0.4 + visual.revealPower * 0.28 + visual.flicker * 0.06) * live;
  ghostMat.uniforms.uIntensity.value =
    (0.035 + visual.coreEnergy * 0.12 + visual.analysis * 0.12 + visual.energyFlow * 0.16) * live;
  tint.setRGB(visual.tintR, visual.tintG, visual.tintB);
  energyMat.uniforms.uColorA.value.copy(tint);
  energyMat.uniforms.uColorB.value.copy(ice);
  ghostMat.uniforms.uColorA.value.copy(ice);
  ghostMat.uniforms.uColorB.value.copy(tint);
  if (shell.value) {
    const s = (0.98 + visual.coreEnergy * 0.085 + visual.revealPower * 0.16) * pulse;
    shell.value.scale.setScalar(s);
  }
  if (nucleus.value) {
    nucleus.value.rotation.y += delta * (0.35 + visual.coreEnergy * 1.4);
    nucleus.value.rotation.x += delta * (0.12 + visual.analysis * 0.4);
    const ns = 0.68 + visual.pulse * 0.13 + visual.revealPower * 0.16;
    nucleus.value.scale.setScalar(ns * pulse);
  }
  if (haloA.value) {
    haloA.value.rotation.z += delta * (0.25 + visual.coreEnergy * 0.8);
  }
  if (haloB.value) {
    haloB.value.rotation.y -= delta * (0.32 + visual.analysis * 1.1);
  }
});

onUnmounted(() => {
  energyMat.dispose();
  ghostMat.dispose();
});
</script>

<template>
  <TresGroup :position="rootPos">
    <TresMesh
      :position="capPos"
      :cast-shadow="true"
    >
      <TresCylinderGeometry :args="[0.42, 0.58, 0.18, 28]" />
      <TresMeshStandardMaterial
        color="#011210"
        :metalness="0.96"
        :roughness="0.22"
      />
    </TresMesh>

    <TresMesh
      :position="columnPos"
      :cast-shadow="true"
    >
      <TresCylinderGeometry :args="[0.2, 0.32, 1.45, 24]" />
      <TresMeshStandardMaterial
        color="#000000"
        :metalness="0.94"
        :roughness="0.2"
      />
    </TresMesh>

    <TresMesh :position="collarPos">
      <TresTorusGeometry :args="[0.3, 0.045, 10, 36]" />
      <TresMeshStandardMaterial
        color="#04452E"
        :emissive="0x0FB576"
        :emissive-intensity="0.04 + visual.coreEnergy * 0.24"
        :metalness="0.96"
        :roughness="0.12"
      />
    </TresMesh>

    <TresMesh :position="stemPos">
      <TresCylinderGeometry :args="[0.12, 0.16, 0.55, 16]" />
      <TresMeshStandardMaterial
        color="#03261E"
        :metalness="0.92"
        :roughness="0.16"
      />
    </TresMesh>

    <TresMesh
      ref="shell"
      :material="energyMat"
    >
      <TresIcosahedronGeometry :args="[0.58, 3]" />
    </TresMesh>

    <TresMesh
      :material="ghostMat"
      :scale="ghostScale"
    >
      <TresIcosahedronGeometry :args="[0.58, 1]" />
    </TresMesh>

    <TresMesh
      :material="ghostMat"
      :scale="innerScale"
    >
      <TresIcosahedronGeometry :args="[0.58, 2]" />
    </TresMesh>

    <TresGroup ref="nucleus">
      <TresMesh>
        <TresDodecahedronGeometry :args="[0.28, 0]" />
        <TresMeshStandardMaterial
          color="#FEFEFE"
          :emissive="0x0FB576"
          :emissive-intensity="(0.12 + visual.coreEnergy * 0.52 + visual.analysis * 0.18 + visual.revealPower * 0.34) * (1 - visual.blackout)"
          :metalness="0.22"
          :roughness="0.16"
        />
      </TresMesh>
      <TresMesh :scale="wireScale">
        <TresOctahedronGeometry :args="[0.22, 0]" />
        <TresMeshStandardMaterial
          color="#8ABFA6"
          :wireframe="true"
          :emissive="0x0FB576"
          :emissive-intensity="0.08 + visual.analysis * 0.34"
          :transparent="true"
          :opacity="0.34 + visual.analysis * 0.14"
        />
      </TresMesh>
    </TresGroup>

    <TresGroup ref="haloA">
      <TresMesh :rotation-x="halfPi">
        <TresTorusGeometry :args="[0.78, 0.012, 8, 72]" />
        <TresMeshStandardMaterial
          color="#04452E"
          :emissive="0x0FB576"
          :emissive-intensity="0.06 + visual.coreEnergy * 0.38 + visual.analysis * 0.12"
          :metalness="0.9"
          :roughness="0.12"
        />
      </TresMesh>
    </TresGroup>

    <TresGroup
      ref="haloB"
      :rotation="haloTilt"
    >
      <TresMesh>
        <TresTorusGeometry :args="[0.96, 0.01, 8, 80]" />
        <TresMeshStandardMaterial
          color="#03261E"
          :emissive="0x8ABFA6"
          :emissive-intensity="0.04 + visual.analysis * 0.32 + visual.revealPower * 0.26"
          :metalness="0.88"
          :roughness="0.14"
          :transparent="true"
          :opacity="0.62 + visual.analysis * 0.18"
        />
      </TresMesh>
    </TresGroup>

    <TresPointLight
      :color="`rgb(${Math.round(visual.tintR * 255)}, ${Math.round(visual.tintG * 255)}, ${Math.round(visual.tintB * 255)})`"
      :intensity="(0.16 + visual.coreEnergy * 0.7 + visual.analysis * 0.16 + visual.revealPower * 0.72) * (1 - visual.blackout)"
      :distance="4.6"
      :decay="2"
    />
  </TresGroup>
</template>
