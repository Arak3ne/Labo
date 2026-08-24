<script setup lang="ts">
import { useLoop } from "@tresjs/core";
import type { Mesh, MeshStandardMaterial } from "three";
import { shallowRef } from "vue";
import { v3 } from "../threeProps";
import { useIncubatorVisual } from "../visualState";

const visual = useIncubatorVisual();
const halfPi = Math.PI / 2;
const beam = shallowRef<Mesh | null>(null);
const leftRing = shallowRef<Mesh | null>(null);
const rightRing = shallowRef<Mesh | null>(null);
const coreRing = shallowRef<Mesh | null>(null);
const leftDisk = shallowRef<Mesh | null>(null);
const rightDisk = shallowRef<Mesh | null>(null);
const residual = shallowRef<Mesh | null>(null);
const beamPos = v3(0, 1.2, 0);
const leftPos = v3(-2.55, 1.2, 0);
const rightPos = v3(2.55, 1.2, 0);
const corePos = v3(0, 1.2, 0);

function applyBand(mesh: Mesh | null, y: number, visible: number, intensity: number) {
  if (!mesh) {
    return;
  }
  mesh.position.y = y;
  mesh.visible = visible > 0.04;
  const material = mesh.material;
  if (material && !Array.isArray(material)) {
    const standard = material as MeshStandardMaterial;
    standard.opacity = 0.08 + visible * 0.72;
    standard.emissiveIntensity = intensity;
  }
}

const { onBeforeRender } = useLoop();

onBeforeRender(() => {
  const live = 1 - visual.blackout;
  const analysisVisible = Math.max(
    visual.scanVisible,
    visual.residualScan * 0.85,
    visual.diagnosticScan * 0.7,
  );
  const leftVisible = Math.max(
    analysisVisible,
    visual.leftFingerprint * 0.88,
    visual.fingerprintSync,
  ) * live;
  const rightVisible = Math.max(
    analysisVisible,
    visual.rightFingerprint * 0.88,
    visual.fingerprintSync,
  ) * live;
  const leftPhase =
    visual.diagnosticScan > 0.01
      ? visual.diagnosticScan
      : visual.analysis > 0.01
        ? visual.scanOffset
        : visual.leftFingerprintScan;
  const rightAnalysisPhase = Math.min(
    1,
    Math.max(0, (visual.scanOffset - 0.12) / 0.88),
  );
  const rightPhase =
    visual.diagnosticScan > 0.01
      ? Math.max(0, visual.diagnosticScan - 0.08)
      : visual.analysis > 0.01
        ? rightAnalysisPhase
        : visual.rightFingerprintScan;
  const leftY = 0.32 + leftPhase * 2.18;
  const rightY = 0.32 + rightPhase * 2.18;
  const y = (leftY + rightY) * 0.5;
  const residualY = 0.38 + visual.scanOffset * 1.95;
  const bridgeVisible =
    Math.max(analysisVisible, visual.fingerprintSync * 0.72) * live;
  if (beam.value) {
    beam.value.position.y = y;
    beam.value.visible = bridgeVisible > 0.04;
    beam.value.scale.set(1, Math.max(bridgeVisible, 0.02), 1);
    const material = beam.value.material;
    if (material && !Array.isArray(material)) {
      const standard = material as MeshStandardMaterial;
      standard.opacity = 0.08 + bridgeVisible * 0.54;
      standard.emissiveIntensity =
        0.6 + bridgeVisible * 2.2 + visual.residualScan * 0.9;
      standard.color.setRGB(visual.tintR, visual.tintG, visual.tintB);
    }
  }
  applyBand(leftRing.value, leftY, leftVisible, 1.2 + leftVisible * 1.5);
  applyBand(rightRing.value, rightY, rightVisible, 1.2 + rightVisible * 1.5);
  applyBand(leftDisk.value, leftY, leftVisible, 0.7 + leftVisible * 1.1);
  applyBand(rightDisk.value, rightY, rightVisible, 0.7 + rightVisible * 1.1);
  if (coreRing.value) {
    coreRing.value.position.y = y * 0.52 + 1.08;
    coreRing.value.visible = bridgeVisible > 0.05;
  }
  if (residual.value) {
    residual.value.position.y = residualY;
    residual.value.visible = visual.residualScan * live > 0.08;
    const material = residual.value.material;
    if (material && !Array.isArray(material)) {
      const standard = material as MeshStandardMaterial;
      standard.opacity = visual.residualScan * 0.55 * live;
      standard.emissiveIntensity = 1.1 + visual.residualScan * 1.6;
    }
  }
});
</script>

<template>
  <TresGroup>
    <TresMesh
      ref="beam"
      :position="beamPos"
    >
      <TresBoxGeometry :args="[5.2, 0.028, 0.32]" />
      <TresMeshStandardMaterial
        color="#8ABFA6"
        :emissive="0x0FB576"
        :emissive-intensity="0.6"
        :transparent="true"
        :opacity="0.2"
      />
    </TresMesh>
    <TresMesh
      ref="leftRing"
      :position="leftPos"
      :rotation-x="halfPi"
    >
      <TresTorusGeometry :args="[0.68, 0.028, 10, 64]" />
      <TresMeshStandardMaterial
        color="#0FB576"
        :emissive="0x0FB576"
        :emissive-intensity="2.2"
        :transparent="true"
        :opacity="0.85"
      />
    </TresMesh>
    <TresMesh
      ref="rightRing"
      :position="rightPos"
      :rotation-x="halfPi"
    >
      <TresTorusGeometry :args="[0.68, 0.028, 10, 64]" />
      <TresMeshStandardMaterial
        color="#8ABFA6"
        :emissive="0x8ABFA6"
        :emissive-intensity="1.7"
        :transparent="true"
        :opacity="0.85"
      />
    </TresMesh>
    <TresMesh
      ref="leftDisk"
      :position="leftPos"
      :rotation-x="halfPi"
    >
      <TresRingGeometry :args="[0.18, 0.62, 40]" />
      <TresMeshStandardMaterial
        color="#0FB576"
        :emissive="0x0FB576"
        :emissive-intensity="0.8"
        :transparent="true"
        :opacity="0.22"
      />
    </TresMesh>
    <TresMesh
      ref="rightDisk"
      :position="rightPos"
      :rotation-x="halfPi"
    >
      <TresRingGeometry :args="[0.18, 0.62, 40]" />
      <TresMeshStandardMaterial
        color="#8ABFA6"
        :emissive="0x8ABFA6"
        :emissive-intensity="0.8"
        :transparent="true"
        :opacity="0.2"
      />
    </TresMesh>
    <TresMesh
      ref="coreRing"
      :position="corePos"
      :rotation-x="halfPi"
    >
      <TresTorusGeometry :args="[0.7, 0.01, 8, 48]" />
      <TresMeshStandardMaterial
        color="#FEFEFE"
        :emissive="0x0FB576"
        :emissive-intensity="0.85"
      />
    </TresMesh>
    <TresMesh
      ref="residual"
      :position="beamPos"
    >
      <TresBoxGeometry :args="[5.05, 0.008, 0.08]" />
      <TresMeshStandardMaterial
        color="#FEFEFE"
        :emissive="0xFEFEFE"
        :emissive-intensity="1.2"
        :transparent="true"
        :opacity="0"
      />
    </TresMesh>
  </TresGroup>
</template>
