import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./PlaygroundScene.vue", import.meta.url), "utf8");
const rigSource = readFileSync(new URL("./PlaygroundRig.vue", import.meta.url), "utf8");

describe("PlaygroundScene fingerprint bridge", () => {
  it.each([
    ["fingerprintFocus", "chamber"],
    ["fingerprintPress", "chamber"],
    ["fingerprintRelease", "chamber"],
    ["fingerprintSync", ""],
    ["fingerprintConfirmed", ""],
  ] as const)("forwards %s to audio and 3D exactly once", (method, argument) => {
    const escapedArgument = argument ? `\\(${argument}\\)` : "\\(\\)";
    const body = source.match(
      new RegExp(`${method}\\(${argument}\\) \\{([\\s\\S]*?)\\n    \\},`),
    )?.[1];

    expect(body).toBeDefined();
    expect(body?.match(new RegExp(`audio\\.${method}${escapedArgument}`, "g"))).toHaveLength(1);
    expect(body?.match(new RegExp(`value\\.${method}${escapedArgument}`, "g"))).toHaveLength(1);
  });
});

describe("PlaygroundScene access bridge", () => {
  it.each([
    "accessTerminalFocus",
    "accessScanStart",
    "accessScanCancel",
    "accessGranted",
  ] as const)("forwards %s to audio and 3D exactly once", (method) => {
    const body = source.match(
      new RegExp(`${method}\\(\\) \\{([\\s\\S]*?)\\n    \\},`),
    )?.[1];

    expect(body).toBeDefined();
    expect(body?.match(new RegExp(`audio\\.${method}\\(\\)`, "g"))).toHaveLength(1);
    expect(body?.match(new RegExp(`value\\.${method}\\(\\)`, "g"))).toHaveLength(1);
  });
});

describe("PlaygroundScene M.O.R.U.E. intro bridge", () => {
  it("forwards intro to 3D, boot SFX, and timeline act callbacks", () => {
    const introBody = source.match(
      /morueInit\(options\?: MorueInitOptions\) \{([\s\S]*?)\n {4}\},/,
    )?.[1];
    const finishBody = source.match(
      /finishMorueInit\(\) \{([\s\S]*?)\n {4}\},/,
    )?.[1];

    expect(introBody).toContain("audio.introBoot()");
    expect(introBody).toContain("value.morueInit(options)");
    expect(finishBody).toContain("value.finishMorueInit()");
    expect(source).toContain("value.resumeMorueInit()");
    expect(source).toContain("audio.introEnter()");
    expect(source).toContain("value.enterLab(options)");
    expect(finishBody).not.toContain("audio.");
  });

  it("keeps the three acts on one master timeline", () => {
    const introBody = rigSource.match(
      /morueInit\(options\?: MorueInitOptions\) \{([\s\S]*?)\n {2}\},\n {2}resumeMorueInit/,
    )?.[1];

    expect(introBody).toBeDefined();
    expect(introBody?.match(/\bplay\(/g)).toHaveLength(1);
    expect(introBody).toContain('addLabel("wake"');
    expect(introBody).toContain('addLabel("threshold"');
    expect(introBody).toContain('addLabel("overview"');
    expect(introBody).toContain("reducedMotion ? 2.8 : 8");
    expect(introBody).toContain('notify("wake")');
    expect(introBody).toContain('notify("identify")');
    expect(introBody).toContain('notify("overview")');
    expect(introBody).toContain('onAct?.("threshold")');
    expect(introBody).toContain("holdIntro");
    expect(introBody).toContain("labPresence: 0");
    expect(introBody).toContain("moruePresence: 1");
    expect(introBody).toContain("airlockPresence: 1");
    expect(introBody).toContain("holdAtAirlock");
    expect(rigSource).toContain("<LabAirlock");
    expect(rigSource).toContain("<MorueVoid");
  });
});

describe("PlaygroundScene reset camera", () => {
  it("returns the camera to the access terminal on focus and reset", () => {
    const focusBody = rigSource.match(
      /accessTerminalFocus\(\) \{([\s\S]*?)\n {2}\},\n {2}accessScanStart/,
    )?.[1];
    const resetBody = source.match(/reset\(\) \{([\s\S]*?)\n {4}\},/)?.[1];

    expect(focusBody).toContain("moveCamera");
    expect(focusBody).toContain("accessTerminalCam");
    expect(focusBody).toContain("accessTerminalLook");
    expect(resetBody).toContain('lastAccessCommand = "accessTerminalFocus"');
    expect(resetBody).toContain("value.reset()");
    expect(rigSource).toContain("api.accessTerminalFocus()");
  });
});
