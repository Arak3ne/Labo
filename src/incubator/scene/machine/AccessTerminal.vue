<script setup lang="ts">
import { onUnmounted } from "vue";
import { e3, v3 } from "../threeProps";
import { useIncubatorVisual } from "../visualState";

const emit = defineEmits<{
  interact: [event: { target: "terminal"; kind: "hover" | "click"; active?: boolean }];
}>();

const visual = useIncubatorVisual();

const terminalPosition = v3(4.25, 0.45, 0);
const screenPosition = v3(0, 0.42, 0.04);
const scannerPosition = v3(0, 0.36, 0.11);
const statusPosition = v3(0, 0.65, 0.08);
const basePosition = v3(0, -0.25, -0.02);
const hitPos = v3(0, 0.22, 0.22);
const terminalRotation = e3(-0.12, -0.22, 0);

function onHover(active: boolean) {
  document.body.style.cursor = active ? "pointer" : "";
  emit("interact", { target: "terminal", kind: "hover", active });
}

function onClick() {
  emit("interact", { target: "terminal", kind: "click" });
}

onUnmounted(() => {
  document.body.style.cursor = "";
});
</script>

<template>
  <TresGroup
    :position="terminalPosition"
    :rotation="terminalRotation"
  >
    <TresMesh
      :position="basePosition"
      :cast-shadow="true"
    >
      <TresCylinderGeometry :args="[0.3, 0.4, 0.5, 8]" />
      <TresMeshStandardMaterial
        color="#011210"
        :metalness="0.94"
        :roughness="0.18"
      />
    </TresMesh>

    <TresMesh :cast-shadow="true">
      <TresBoxGeometry :args="[0.92, 0.72, 0.18]" />
      <TresMeshStandardMaterial
        color="#03261E"
        :emissive="0x087D49"
        :emissive-intensity="0.04 + visual.accessTerminal * 0.16 + visual.accessUnlock * 0.28"
        :metalness="0.9"
        :roughness="0.2"
      />
    </TresMesh>

    <TresMesh :position="screenPosition">
      <TresPlaneGeometry :args="[0.68, 0.28]" />
      <TresMeshStandardMaterial
        color="#011210"
        :emissive="0x0FB576"
        :emissive-intensity="0.06 + visual.accessTerminal * 0.5 + visual.accessScan * 0.65 + visual.accessUnlock * 0.8"
        :metalness="0.72"
        :roughness="0.18"
      />
    </TresMesh>

    <TresMesh :position="scannerPosition">
      <TresPlaneGeometry :args="[0.58, 0.025]" />
      <TresMeshBasicMaterial
        color="#8ABFA6"
        :transparent="true"
        :opacity="visual.accessScan * 0.9"
        :depth-write="false"
      />
    </TresMesh>

    <TresMesh :position="statusPosition">
      <TresBoxGeometry :args="[0.32, 0.035, 0.025]" />
      <TresMeshStandardMaterial
        color="#03261E"
        :emissive="0x8ABFA6"
        :emissive-intensity="0.04 + visual.accessTerminal * 0.22 + visual.accessUnlock"
        :metalness="0.82"
        :roughness="0.16"
      />
    </TresMesh>

    <TresMesh
      :position="hitPos"
      @click="onClick"
      @pointerenter="onHover(true)"
      @pointerleave="onHover(false)"
    >
      <TresBoxGeometry :args="[1.05, 1.05, 0.42]" />
      <TresMeshBasicMaterial
        :transparent="true"
        :opacity="0"
        :depth-write="false"
      />
    </TresMesh>
  </TresGroup>
</template>
