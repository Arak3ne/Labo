import { createHash } from "node:crypto";

const kind = process.argv[2];
const value = process.argv[3];

if ((kind !== "pattern" && kind !== "host") || !value) {
  console.error("Usage: node scripts/seal-d14.mjs pattern 0,1,2");
  console.error("       node scripts/seal-d14.mjs host example");
  process.exit(1);
}

process.stdout.write(
  createHash("sha256").update(`d14.${kind}.v1:${value}`).digest("hex") + "\n",
);
