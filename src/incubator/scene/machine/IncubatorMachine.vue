<script setup lang="ts">
import ChamberVapor from "../fx/ChamberVapor.vue";
import EnergyConduits from "../fx/EnergyConduits.vue";
import HoloBackdrop from "../fx/HoloBackdrop.vue";
import ParticleField from "../fx/ParticleField.vue";
import RevealBurst from "../fx/RevealBurst.vue";
import ScanSweep from "../fx/ScanSweep.vue";
import AccessTerminal from "./AccessTerminal.vue";
import CentralCore from "./CentralCore.vue";
import Gantry from "./Gantry.vue";
import LabPlatform from "./LabPlatform.vue";
import MechanicalRings from "./MechanicalRings.vue";
import SubjectChamber from "./SubjectChamber.vue";
import TechnicalHarness from "./TechnicalHarness.vue";

const emit = defineEmits<{
  interact: [event: { target: "left" | "right" | "terminal"; kind: "hover" | "click"; active?: boolean }];
}>();
</script>

<template>
  <TresGroup>
    <LabPlatform />
    <AccessTerminal @interact="emit('interact', $event)" />
    <TechnicalHarness />
    <Gantry />
    <SubjectChamber
      side="left"
      @interact="emit('interact', $event)"
    />
    <SubjectChamber
      side="right"
      @interact="emit('interact', $event)"
    />
    <ChamberVapor />
    <CentralCore />
    <MechanicalRings />
    <ScanSweep />
    <EnergyConduits />
    <HoloBackdrop />
    <ParticleField />
    <RevealBurst />
  </TresGroup>
</template>
