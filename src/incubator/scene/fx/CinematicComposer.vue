<script setup lang="ts">
import {
  BloomPmndrs,
  ChromaticAberrationPmndrs,
  EffectComposerPmndrs,
  VignettePmndrs,
} from "@tresjs/post-processing";
import { computed } from "vue";
import { incubatorChromaOffset, incubatorPostFx } from "../visualState";

const bloomIntensity = computed(() => incubatorPostFx.bloom);
const vignetteDarkness = computed(() => incubatorPostFx.vignette);
</script>

<template>
  <Suspense>
    <EffectComposerPmndrs>
      <BloomPmndrs
        :intensity="bloomIntensity"
        :luminance-threshold="0.44"
        :luminance-smoothing="0.48"
        :mipmap-blur="true"
      />
      <VignettePmndrs
        :offset="0.22"
        :darkness="vignetteDarkness"
      />
      <ChromaticAberrationPmndrs
        :offset="incubatorChromaOffset"
        :radial-modulation="true"
        :modulation-offset="0.22"
      />
    </EffectComposerPmndrs>
  </Suspense>
</template>
