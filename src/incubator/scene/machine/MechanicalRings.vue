<script setup lang="ts">
import { useLoop } from "@tresjs/core";
import type { Group } from "three";
import { shallowRef } from "vue";
import { e3, v3 } from "../threeProps";
import { useIncubatorVisual } from "../visualState";

const visual = useIncubatorVisual();
const rootPos = v3(0, 1.72, 0);
const tiltSlow = e3(0.3, 0.22, 0.04);
const tiltFast = e3(-0.24, 0.42, -0.08);
const ringTilt = shallowRef<Group | null>(null);
const ringInner = shallowRef<Group | null>(null);

const { onBeforeRender } = useLoop();

onBeforeRender(({ delta }) => {
  const speed = visual.ringVelocity;
  if (ringTilt.value) {
    ringTilt.value.rotation.z -= delta * speed * 0.34;
    ringTilt.value.rotation.y += delta * speed * 0.08;
  }
  if (ringInner.value) {
    ringInner.value.rotation.y += delta * speed * 1.55;
  }
});
</script>

<template>
  <TresGroup :position="rootPos">
    <TresGroup
      ref="ringTilt"
      :rotation="tiltSlow"
    >
      <TresMesh>
        <TresTorusGeometry :args="[0.98, 0.02, 10, 80]" />
        <TresMeshStandardMaterial
          color="#03261E"
          :emissive="0x8ABFA6"
          :emissive-intensity="0.02 + visual.analysis * 0.38"
          :metalness="0.94"
          :roughness="0.16"
        />
      </TresMesh>
    </TresGroup>
    <TresGroup
      ref="ringInner"
      :rotation="tiltFast"
    >
      <TresMesh>
        <TresTorusGeometry :args="[0.68, 0.016, 8, 72]" />
        <TresMeshStandardMaterial
          color="#04452E"
          :emissive="0x0FB576"
          :emissive-intensity="0.018 + visual.revealPower * 0.5 + visual.coreEnergy * 0.07"
          :metalness="0.92"
          :roughness="0.14"
        />
      </TresMesh>
    </TresGroup>
  </TresGroup>
</template>
