<script setup lang="ts">
import { useLoop } from "@tresjs/core";
import type { Mesh } from "three";
import { shallowRef } from "vue";

const cube = shallowRef<Mesh | null>(null);

const { onBeforeRender } = useLoop();

onBeforeRender(({ delta }) => {
  if (!cube.value) {
    return;
  }
  cube.value.rotation.y += delta * 0.5;
});
</script>

<template>
  <TresMesh ref="cube">
    <TresBoxGeometry :args="[1, 1, 1]" />
    <TresMeshStandardMaterial
      color="#087D49"
      :emissive="0x05603C"
      :emissive-intensity="0.35"
    />
  </TresMesh>
</template>
