<script setup lang="ts">
import { useLoop } from "@tresjs/core";
import { onUnmounted } from "vue";
import { createHoloMaterial } from "../materials/createHoloMaterial";
import { v3 } from "../threeProps";
import { useIncubatorVisual } from "../visualState";

const visual = useIncubatorVisual();
const yaw = Math.PI / 2.6;
const rear = createHoloMaterial(0x8abfa6, 0.5);
const left = createHoloMaterial(0x0fb576, 0.32);
const right = createHoloMaterial(0x8abfa6, 0.32);
const rearPos = v3(0, 2.15, -5.6);
const farPos = v3(0, 2.4, -9.2);
const leftPos = v3(-4.4, 1.55, 0.2);
const rightPos = v3(4.4, 1.55, 0.2);
const far = createHoloMaterial(0x05603c, 0.22);

const { onBeforeRender } = useLoop();

onBeforeRender(({ elapsed }) => {
  for (const material of [rear, left, right, far]) {
    material.uniforms.uTime.value = elapsed;
    material.uniforms.uScan.value = visual.scanOffset;
  }
  rear.uniforms.uOpacity.value = 0.1 + visual.analysis * 0.16 + visual.revealPower * 0.18;
  far.uniforms.uOpacity.value = 0.035 + visual.analysis * 0.055;
  left.uniforms.uOpacity.value = 0.09 + visual.leftEmphasis * 0.32 + visual.subjectPresence * 0.08;
  right.uniforms.uOpacity.value = 0.09 + visual.rightEmphasis * 0.32 + visual.subjectPresence * 0.08;
  rear.uniforms.uColor.value.setRGB(visual.tintR, visual.tintG, visual.tintB);
});

onUnmounted(() => {
  rear.dispose();
  left.dispose();
  right.dispose();
  far.dispose();
});
</script>

<template>
  <TresGroup>
    <TresMesh
      :position="rearPos"
      :material="rear"
    >
      <TresPlaneGeometry :args="[9.4, 4.6]" />
    </TresMesh>
    <TresMesh
      :position="farPos"
      :material="far"
    >
      <TresPlaneGeometry :args="[14, 6.4]" />
    </TresMesh>
    <TresMesh
      :position="leftPos"
      :rotation-y="yaw"
      :material="left"
    >
      <TresPlaneGeometry :args="[2.6, 2.8]" />
    </TresMesh>
    <TresMesh
      :position="rightPos"
      :rotation-y="-yaw"
      :material="right"
    >
      <TresPlaneGeometry :args="[2.6, 2.8]" />
    </TresMesh>
  </TresGroup>
</template>
