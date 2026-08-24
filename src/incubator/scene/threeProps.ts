import { Euler, Vector3 } from "three";

export function v3(x = 0, y = 0, z = 0): Vector3 {
  return new Vector3(x, y, z);
}

export function e3(x = 0, y = 0, z = 0): Euler {
  return new Euler(x, y, z);
}
