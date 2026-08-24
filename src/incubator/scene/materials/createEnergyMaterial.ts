import { AdditiveBlending, Color, ShaderMaterial } from "three";
import energyFrag from "../shaders/energy.frag.glsl";
import energyVert from "../shaders/energy.vert.glsl";

export function createEnergyMaterial() {
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 0.28 },
      uColorA: { value: new Color("#0FB576") },
      uColorB: { value: new Color("#8ABFA6") },
    },
    vertexShader: energyVert,
    fragmentShader: energyFrag,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  });
}
