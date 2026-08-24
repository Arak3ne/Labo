uniform float uTime;
uniform float uIntensity;
uniform vec3 uColorA;
uniform vec3 uColorB;

varying vec3 vNormal;
varying vec3 vViewDir;
varying vec2 vUv;
varying float vElevation;

void main() {
  float fresnel = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewDir)), 0.0), 1.85);
  float bands = sin((vUv.y + vElevation) * 22.0 - uTime * 4.4);
  bands = smoothstep(0.05, 0.92, bands);
  float veins = sin(vUv.x * 28.0 + uTime * 1.8 + vElevation * 6.0);
  veins = smoothstep(0.35, 0.95, veins);
  float pulse = 0.74 + 0.26 * sin(uTime * 2.15);
  vec3 peak = vec3(0.9961);
  vec3 hot = mix(uColorA, peak, veins * 0.32);
  vec3 color = mix(hot, uColorB, fresnel * 0.48 + bands * 0.12);
  float alpha = (0.12 + fresnel * 0.68 + bands * 0.18 + veins * 0.08) * uIntensity * pulse;
  gl_FragColor = vec4(color * (0.78 + uIntensity * 0.38), clamp(alpha, 0.0, 1.0));
}
