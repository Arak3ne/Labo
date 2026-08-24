<script setup lang="ts">
import { v3 } from "../threeProps";
import { useIncubatorVisual } from "../visualState";

const visual = useIncubatorVisual();
const beamPos = v3(0, 2.62, 0);
const rearBeam = v3(0, 2.62, -0.42);
const accentPos = v3(0, 2.62, 0.32);
const leftServo = v3(-2.55, 2.58, 0);
const rightServo = v3(2.55, 2.58, 0);
const leftArm = v3(-2.55, 2.18, 0);
const rightArm = v3(2.55, 2.18, 0);
const pistonPos = v3(0, 2.92, 0);
const massPos = v3(0, 2.86, 0);
const cableL = v3(-1.25, 2.48, 0.08);
const cableR = v3(1.25, 2.48, 0.08);
const railFront = v3(0, 2.72, 0.22);
const railBack = v3(0, 2.72, -0.22);
const leftBrace = v3(-2.55, 1.72, -0.32);
const rightBrace = v3(2.55, 1.72, -0.32);
const halfPi = Math.PI / 2;
</script>

<template>
  <TresGroup>
    <TresMesh
      :position="beamPos"
      :cast-shadow="true"
    >
      <TresBoxGeometry :args="[5.5, 0.1, 0.22]" />
      <TresMeshStandardMaterial
        color="#011210"
        :metalness="0.94"
        :roughness="0.18"
      />
    </TresMesh>
    <TresMesh
      :position="rearBeam"
      :cast-shadow="true"
    >
      <TresBoxGeometry :args="[5.1, 0.08, 0.14]" />
      <TresMeshStandardMaterial
        color="#03261E"
        :metalness="0.9"
        :roughness="0.22"
      />
    </TresMesh>
    <TresMesh :position="accentPos">
      <TresBoxGeometry :args="[1.8, 0.045, 0.07]" />
      <TresMeshStandardMaterial
        color="#04452E"
        :emissive="0x0FB576"
        :emissive-intensity="0.18 + visual.analysis * 0.7 + visual.lockAmount * 0.35"
        :metalness="0.86"
        :roughness="0.16"
      />
    </TresMesh>
    <TresMesh :position="massPos">
      <TresBoxGeometry :args="[0.55, 0.28, 0.36]" />
      <TresMeshStandardMaterial
        color="#000000"
        :metalness="0.92"
        :roughness="0.2"
      />
    </TresMesh>
    <TresMesh :position="leftServo">
      <TresBoxGeometry :args="[0.28, 0.34, 0.26]" />
      <TresMeshStandardMaterial
        color="#03261E"
        :metalness="0.9"
        :roughness="0.16"
      />
    </TresMesh>
    <TresMesh :position="rightServo">
      <TresBoxGeometry :args="[0.28, 0.34, 0.26]" />
      <TresMeshStandardMaterial
        color="#03261E"
        :metalness="0.9"
        :roughness="0.16"
      />
    </TresMesh>
    <TresMesh :position="leftArm">
      <TresBoxGeometry :args="[0.08, 0.72, 0.08]" />
      <TresMeshStandardMaterial
        color="#04452E"
        :metalness="0.95"
        :roughness="0.12"
      />
    </TresMesh>
    <TresMesh :position="rightArm">
      <TresBoxGeometry :args="[0.08, 0.72, 0.08]" />
      <TresMeshStandardMaterial
        color="#04452E"
        :metalness="0.95"
        :roughness="0.12"
      />
    </TresMesh>
    <TresMesh :position="pistonPos">
      <TresCylinderGeometry :args="[0.07, 0.07, 0.55, 14]" />
      <TresMeshStandardMaterial
        color="#8ABFA6"
        :emissive="0x0FB576"
        :emissive-intensity="0.35 + visual.coreEnergy * 0.55"
        :metalness="0.96"
        :roughness="0.1"
      />
    </TresMesh>
    <TresMesh :position="cableL">
      <TresCylinderGeometry :args="[0.012, 0.012, 2.3, 6]" />
      <TresMeshStandardMaterial
        color="#011210"
        :metalness="0.7"
        :roughness="0.35"
      />
    </TresMesh>
    <TresMesh
      :position="cableR"
    >
      <TresCylinderGeometry :args="[0.012, 0.012, 2.3, 6]" />
      <TresMeshStandardMaterial
        color="#011210"
        :metalness="0.7"
        :roughness="0.35"
      />
    </TresMesh>
    <TresMesh
      :position="railFront"
      :rotation-z="halfPi"
    >
      <TresCylinderGeometry :args="[0.018, 0.018, 5.2, 10]" />
      <TresMeshStandardMaterial
        color="#04452E"
        :metalness="0.95"
        :roughness="0.12"
      />
    </TresMesh>
    <TresMesh
      :position="railBack"
      :rotation-z="halfPi"
    >
      <TresCylinderGeometry :args="[0.018, 0.018, 5.2, 10]" />
      <TresMeshStandardMaterial
        color="#04452E"
        :metalness="0.95"
        :roughness="0.12"
      />
    </TresMesh>
    <TresMesh :position="leftBrace">
      <TresBoxGeometry :args="[0.08, 1.55, 0.1]" />
      <TresMeshStandardMaterial
        color="#011210"
        :metalness="0.9"
        :roughness="0.2"
      />
    </TresMesh>
    <TresMesh :position="rightBrace">
      <TresBoxGeometry :args="[0.08, 1.55, 0.1]" />
      <TresMeshStandardMaterial
        color="#011210"
        :metalness="0.9"
        :roughness="0.2"
      />
    </TresMesh>
  </TresGroup>
</template>
