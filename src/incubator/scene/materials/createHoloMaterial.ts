import { AdditiveBlending, Color, DoubleSide, ShaderMaterial } from "three";
import holoFrag from "../shaders/holo.frag.glsl";
import holoVert from "../shaders/holo.vert.glsl";

export function createHoloMaterial(hex: number, opacity = 0.55) {
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: opacity },
      uScan: { value: 0 },
      uColor: { value: new Color(hex) },
    },
    vertexShader: holoVert,
    fragmentShader: holoFrag,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
  });
}
