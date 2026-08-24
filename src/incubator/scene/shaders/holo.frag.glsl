uniform float uTime;
uniform float uOpacity;
uniform float uScan;
uniform vec3 uColor;

varying vec2 vUv;
varying vec3 vWorldPos;

void main() {
  float line = abs(fract(vUv.y * 72.0 - uTime * 0.35) - 0.5);
  float scanlines = smoothstep(0.42, 0.08, line);
  vec2 gv = abs(fract(vUv * vec2(18.0, 10.0)) - 0.5);
  float hex = smoothstep(0.46, 0.4, min(gv.x, gv.y));
  float sweep = 1.0 - smoothstep(0.0, 0.18, abs(vUv.y - fract(uTime * 0.12 + uScan * 0.35)));
  float edge = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
  edge *= smoothstep(0.0, 0.06, vUv.y) * smoothstep(1.0, 0.94, vUv.y);
  float flicker = 0.86 + 0.14 * step(0.04, fract(sin(uTime * 18.0) * 43758.5453));
  float alpha = (0.08 + scanlines * 0.22 + hex * 0.16 + sweep * 0.35) * edge * uOpacity * flicker;
  vec3 color = uColor * (0.55 + sweep * 0.9 + hex * 0.35);
  gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.85));
}
