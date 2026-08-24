varying vec3 vNormal;
varying vec3 vViewDir;
varying vec2 vUv;
varying float vElevation;

void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vec4 view = viewMatrix * world;
  vNormal = normalize(normalMatrix * normal);
  vViewDir = normalize(-view.xyz);
  vElevation = position.y;
  gl_Position = projectionMatrix * view;
}
