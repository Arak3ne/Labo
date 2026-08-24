<script setup lang="ts">
import { TresCanvas } from "@tresjs/core";
import { BloomPmndrs, EffectComposerPmndrs } from "@tresjs/post-processing";
import { Vector3 } from "three";
import ProbeCube from "./ProbeCube.vue";

const cameraPosition = new Vector3(3, 2, 5);
const lightPosition = new Vector3(4, 6, 2);
</script>

<template>
  <div
    data-incubator-scene
    style="width: 100%; height: 70vh"
  >
    <TresCanvas
      clear-color="#011210"
      :window-size="false"
    >
      <TresPerspectiveCamera :position="cameraPosition" />
      <TresAmbientLight :intensity="0.55" />
      <TresDirectionalLight
        :position="lightPosition"
        :intensity="1.15"
      />
      <ProbeCube />
      <Suspense>
        <EffectComposerPmndrs>
          <BloomPmndrs
            :intensity="0.35"
            :luminance-threshold="0.7"
          />
        </EffectComposerPmndrs>
      </Suspense>
    </TresCanvas>
  </div>
</template>
