<script setup lang="ts">
import { HolographicMaterial } from "@tresjs/cientos";
import { useLoop } from "@tresjs/core";
import { Color, Vector3 } from "three";
import { computed, onUnmounted } from "vue";
import { createHoloMaterial } from "../materials/createHoloMaterial";
import { v3 } from "../threeProps";
import { useIncubatorVisual } from "../visualState";

const props = defineProps<{
  side: "left" | "right";
}>();

const visual = useIncubatorVisual();
const isLeft = props.side === "left";
const figureMat = createHoloMaterial(isLeft ? 0x0fb576 : 0x8abfa6, 0.18);
const hologramColor = new Color(isLeft ? "#0FB576" : "#8ABFA6");
const figureScale = new Vector3(1, 1, 1);
const ghostPos = v3(0, 0.02, 0);
const ghostScale = v3(1.05, 1.02, 1.05);
const headPos = v3(0, 0.4, 0);
const torsoPos = v3(0, 0.06, 0);
const leftLegPos = v3(-0.09, -0.3, 0);
const rightLegPos = v3(0.09, -0.3, 0);

const emphasis = computed(() => {
  return isLeft ? visual.leftEmphasis : visual.rightEmphasis;
});

const ghostOpacity = computed(() => {
  return (0.025 + visual.subjectPresence * 0.5 + emphasis.value * 0.16 + visual.analysis * 0.1) * (1 - visual.blackout);
});

const { onBeforeRender } = useLoop();

onBeforeRender(({ elapsed }) => {
  const live = 1 - visual.blackout;
  const breath = Math.sin(elapsed * (1.35 + visual.analysis * 2.4) + (isLeft ? 0 : 0.42));
  const vertical = 1 + breath * (0.008 + visual.subjectPresence * 0.008 + visual.analysis * 0.018);
  const lateral = 1 - breath * (0.003 + visual.analysis * 0.006);
  figureScale.set(lateral, vertical, lateral);
  figureMat.uniforms.uTime.value = elapsed;
  figureMat.uniforms.uScan.value = isLeft
    ? visual.scanOffset
    : (visual.scanOffset + 0.14 * visual.scanVisible) % 1;
  figureMat.uniforms.uOpacity.value =
    (0.025 + visual.subjectPresence * 0.68 + emphasis.value * 0.18 + visual.analysis * 0.16) * live;
});

onUnmounted(() => {
  figureMat.dispose();
});
</script>

<template>
  <TresGroup :scale="figureScale">
    <TresMesh
      :position="ghostPos"
      :scale="ghostScale"
    >
      <TresCapsuleGeometry :args="[0.2, 0.58, 6, 16]" />
      <HolographicMaterial
        :hologram-color="hologramColor"
        :hologram-opacity="ghostOpacity"
        :scanline-size="14"
        :signal-speed="0.38 + visual.analysis * 0.72"
      />
    </TresMesh>

    <TresMesh
      :position="headPos"
      :material="figureMat"
    >
      <TresSphereGeometry :args="[0.115, 16, 12]" />
    </TresMesh>

    <TresMesh
      :position="torsoPos"
      :material="figureMat"
    >
      <TresCapsuleGeometry :args="[0.145, 0.28, 5, 12]" />
    </TresMesh>

    <TresMesh
      :position="leftLegPos"
      :material="figureMat"
    >
      <TresCapsuleGeometry :args="[0.055, 0.28, 4, 10]" />
    </TresMesh>

    <TresMesh
      :position="rightLegPos"
      :material="figureMat"
    >
      <TresCapsuleGeometry :args="[0.055, 0.28, 4, 10]" />
    </TresMesh>
  </TresGroup>
</template>
