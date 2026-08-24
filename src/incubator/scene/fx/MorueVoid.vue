<script setup lang="ts">
import { useLoop } from "@tresjs/core";
import { AdditiveBlending, Color, MeshBasicMaterial } from "three";
import { computed, onUnmounted } from "vue";
import { createHoloMaterial } from "../materials/createHoloMaterial";
import { v3 } from "../threeProps";
import { useIncubatorVisual } from "../visualState";

const visual = useIncubatorVisual();
const rear = createHoloMaterial(0x05603c, 0);
const floor = createHoloMaterial(0x03261e, 0);
const haze = new MeshBasicMaterial({
  color: new Color("#0FB576"),
  transparent: true,
  opacity: 0,
  depthWrite: false,
  fog: false,
  toneMapped: false,
  blending: AdditiveBlending,
});
const rearPos = v3(0.55, 1.72, -2.4);
const floorPos = v3(0.4, 0.02, 0.4);
const hazePos = v3(0.7, 1.7, -0.8);
const voidVisible = computed(() => visual.labPresence < 0.96);

const { onBeforeRender } = useLoop();

onBeforeRender(({ elapsed }) => {
  const presence = 1 - visual.labPresence;
  rear.uniforms.uTime.value = elapsed;
  floor.uniforms.uTime.value = elapsed * 0.62;
  rear.uniforms.uScan.value = 0.25 + visual.diagnosticScan * 0.7;
  floor.uniforms.uScan.value = visual.diagnosticScan * 0.4;
  rear.uniforms.uOpacity.value = presence * (0.14 + visual.moruePresence * 0.1);
  floor.uniforms.uOpacity.value = presence * 0.07;
  haze.opacity = presence * 0.035 * visual.moruePresence;
});

onUnmounted(() => {
  rear.dispose();
  floor.dispose();
  haze.dispose();
});
</script>

<template>
  <TresGroup :visible="voidVisible">
    <TresMesh
      :position="rearPos"
      :material="rear"
      :render-order="2"
    >
      <TresPlaneGeometry :args="[18, 9.2]" />
    </TresMesh>
    <TresMesh
      :position="floorPos"
      :rotation-x="-1.5708"
      :material="floor"
      :render-order="1"
    >
      <TresPlaneGeometry :args="[16, 14]" />
    </TresMesh>
    <TresMesh
      :position="hazePos"
      :material="haze"
      :render-order="3"
    >
      <TresPlaneGeometry :args="[9.4, 5.2]" />
    </TresMesh>
  </TresGroup>
</template>
