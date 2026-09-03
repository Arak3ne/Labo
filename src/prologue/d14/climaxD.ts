import gsap from "gsap";
import { stingBlow, stingCrtOff, stingTear } from "./catastropheAudio";

const D07_IN = "cubic-bezier(0.22, 1, 0.36, 1)";
const D07_SNAP = "cubic-bezier(0.16, 1, 0.3, 1)";
const HARD = "power4.in";

export type DeathLayer =
  | "scan"
  | "alarm"
  | "kill"
  | "tear"
  | "rgb"
  | "shake"
  | "crt"
  | "black";

export interface ClimaxDCallbacks {
  onElias: (visible: boolean) => void;
  onStamp: (index: number) => void;
  onCut: (on: boolean) => void;
  onLayer: (name: DeathLayer, on: boolean) => void;
}

export interface ClimaxDHandle {
  kill: () => void;
}

function present(nodes: Array<HTMLElement | null>): HTMLElement[] {
  return nodes.filter((el): el is HTMLElement => Boolean(el));
}

/**
 * Climax D — mort du terminal. Palette cassée, déchirures, extinction CRT.
 */
export function playClimaxD(
  root: HTMLElement,
  callbacks: ClimaxDCallbacks,
): ClimaxDHandle {
  const files = gsap.utils.toArray<HTMLElement>(root.querySelectorAll(".d14-file"));
  const fragment = root.querySelector<HTMLElement>(".d14-fragment");
  const folders = gsap.utils.toArray<HTMLElement>(root.querySelectorAll(".d14-folder"));
  const ticks = gsap.utils.toArray<HTMLElement>(root.querySelectorAll(".d14-revoke-meter__tick"));
  const session = root.querySelector<HTMLElement>(".d14-chip--session");
  const anomaly = root.querySelector<HTMLElement>(".d14-anomaly");
  const headerFilet = root.querySelector<HTMLElement>(".d14-filet--header");
  const stripFilet = root.querySelector<HTMLElement>(".d14-filet--strip");
  const footFilet = root.querySelector<HTMLElement>(".d14-filet--foot");
  const footer = root.querySelector<HTMLElement>(".d14__foot");
  const index = root.querySelector<HTMLElement>(".d14-index");
  const panel = root.querySelector<HTMLElement>(".d14-panel");
  const frame = root.querySelector<HTMLElement>(".d14__frame");
  const stage = root.querySelector<HTMLElement>(".d14__stage");
  const header = root.querySelector<HTMLElement>(".d14-header");
  const strip = root.querySelector<HTMLElement>(".d14-strip");
  const terminal = root.querySelector<HTMLElement>(".d14__terminal");
  const clock = root.querySelector<HTMLElement>(".d14__clock");
  const brand = root.querySelector<HTMLElement>(".d14__brand");
  const brandD07 = root.querySelector<HTMLElement>(".d14__brand-d07");
  const panelTitle = root.querySelector<HTMLElement>(".d14-panel__title");
  const panelBack = root.querySelector<HTMLElement>(".d14-panel__back");
  const fileNotice = root.querySelector<HTMLElement>(".d14-file-notice");
  const blow = root.querySelector<HTMLElement>(".d14-death__blow");
  const line = root.querySelector<HTMLElement>(".d14-death__line");
  const dot = root.querySelector<HTMLElement>(".d14-death__dot");
  const tearBand = root.querySelector<HTMLElement>(".d14-death__tear");

  const tl = gsap.timeline();

  function layer(name: DeathLayer, on: boolean, at: number): void {
    tl.add(() => {
      callbacks.onLayer(name, on);
    }, at);
  }

  function cut(at: number, ms = 0.05): void {
    tl.add(() => {
      callbacks.onCut(true);
    }, at);
    tl.add(() => {
      callbacks.onCut(false);
    }, at + ms);
  }

  function hit(at: number): void {
    layer("tear", true, at);
    layer("rgb", true, at);
    layer("shake", true, at);
    tl.add(() => {
      stingTear();
    }, at);
    if (tearBand) {
      tl.fromTo(
        tearBand,
        { opacity: 0.9, scaleX: 1, y: gsap.utils.random(-80, 80) },
        { opacity: 0, duration: 0.18, ease: "none" },
        at,
      );
    }
    layer("tear", false, at + 0.18);
    layer("rgb", false, at + 0.16);
    layer("shake", false, at + 0.22);
  }

  gsap.set([...files, ...folders], { overflow: "hidden" });
  if (line) gsap.set(line, { scaleX: 0, opacity: 0 });
  if (dot) gsap.set(dot, { scale: 0, opacity: 0 });
  if (blow) gsap.set(blow, { opacity: 0 });
  if (tearBand) gsap.set(tearBand, { opacity: 0, scaleX: 1 });

  layer("scan", true, 0);
  layer("kill", true, 0);

  tl.add(() => {
    callbacks.onStamp(0);
  }, 0.08);
  tl.add(() => {
    callbacks.onStamp(1);
  }, 0.32);
  tl.add(() => {
    callbacks.onStamp(2);
  }, 0.52);
  tl.add(() => {
    callbacks.onStamp(3);
  }, 0.74);
  tl.add(() => {
    callbacks.onStamp(4);
  }, 0.96);
  tl.add(() => {
    callbacks.onStamp(0);
  }, 1.35);
  tl.add(() => {
    callbacks.onStamp(2);
  }, 1.7);
  tl.add(() => {
    callbacks.onStamp(4);
  }, 2.05);

  hit(0.45);
  hit(1.15);
  hit(2.1);
  hit(3.2);
  hit(4.4);

  cut(0.6, 0.06);
  cut(1.9, 0.08);
  cut(3.05, 0.07);
  cut(4.55, 0.1);

  if (ticks.length > 0) {
    gsap.set(ticks, { backgroundColor: "#3A1210" });
    tl.to(
      ticks,
      { backgroundColor: "#E24B3A", duration: 0.05, stagger: 0.08, ease: "none" },
      0.2,
    );
  }

  files.forEach((el, i) => {
    gsap.set(el, { transformOrigin: "left center" });
    tl.fromTo(
      el,
      { clipPath: "inset(0 0 0 0)", x: 0 },
      { clipPath: "inset(0 0 0 100%)", x: 12, duration: 0.1, ease: HARD },
      1.55 + i * 0.08,
    );
  });

  if (fragment) {
    tl.fromTo(
      fragment,
      { clipPath: "inset(0 0 0 0)", x: 0 },
      { clipPath: "inset(0 38% 0 0)", x: -10, duration: 0.12, ease: HARD },
      1.9,
    );
    tl.to(
      fragment,
      { clipPath: "inset(0 0 0 100%)", duration: 0.12, ease: HARD },
      2.2,
    );
  }

  folders.forEach((folder, i) => {
    tl.to(
      folder,
      {
        height: 0,
        minHeight: 0,
        paddingTop: 0,
        paddingBottom: 0,
        borderBottomWidth: 0,
        x: i % 2 === 0 ? 10 : -10,
        duration: 0.1,
        ease: HARD,
      },
      2.45 + i * 0.09,
    );
  });

  const panelChrome = present([panelTitle, panelBack, fileNotice]);
  if (panelChrome.length > 0) {
    tl.to(
      panelChrome,
      { clipPath: "inset(0 0 0 100%)", duration: 0.1, ease: D07_SNAP, stagger: 0.04 },
      3.4,
    );
  }

  if (index) {
    tl.to(
      index,
      {
        width: 0,
        minWidth: 0,
        borderRightWidth: 0,
        overflow: "hidden",
        duration: 0.18,
        ease: HARD,
      },
      3.7,
    );
  }
  if (panel) {
    tl.to(
      panel,
      { width: 0, minWidth: 0, paddingLeft: 0, paddingRight: 0, overflow: "hidden", duration: 0.16, ease: HARD },
      3.85,
    );
  }

  const identity = present([session]);
  identity.forEach((el, i) => {
    tl.fromTo(
      el,
      { clipPath: "inset(0 0 0 0)", x: 0 },
      { clipPath: "inset(0 0 0 100%)", x: 8, duration: 0.14, ease: HARD, immediateRender: false },
      4.35 + i * 0.1,
    );
  });

  if (footer) {
    tl.to(
      footer,
      {
        height: 0,
        minHeight: 0,
        paddingTop: 0,
        paddingBottom: 0,
        overflow: "hidden",
        duration: 0.14,
        ease: HARD,
      },
      4.85,
    );
  }
  if (footFilet) {
    tl.to(footFilet, { scaleX: 0, duration: 0.14, ease: HARD }, 4.85);
  }

  const leftoverChrome = present([terminal, clock, brand, brandD07]);
  if (leftoverChrome.length > 0) {
    tl.to(
      leftoverChrome,
      { clipPath: "inset(0 0 0 100%)", duration: 0.12, ease: HARD, stagger: 0.03 },
      5.05,
    );
  }

  const filets = present([headerFilet, stripFilet, anomaly]);
  if (filets.length > 0) {
    tl.to(
      filets,
      { scaleX: 0, duration: 0.28, ease: D07_IN, transformOrigin: "left center" },
      5.2,
    );
  }

  if (strip) {
    tl.to(
      strip,
      { height: 0, paddingTop: 0, paddingBottom: 0, overflow: "hidden", duration: 0.12, ease: HARD },
      5.4,
    );
  }
  if (header) {
    tl.to(
      header,
      { height: 0, minHeight: 0, paddingTop: 0, paddingBottom: 0, overflow: "hidden", duration: 0.12, ease: HARD },
      5.5,
    );
  }

  if (stage) {
    tl.set(stage, { backgroundColor: "#000000" }, 5.65);
  }

  if (blow) {
    tl.add(() => {
      stingBlow();
    }, 5.75);
    tl.to(blow, { opacity: 1, duration: 0.06, ease: "none" }, 5.75);
    tl.to(blow, { opacity: 0, duration: 0.2, ease: "power2.out" }, 5.86);
  }

  layer("crt", true, 5.95);
  layer("scan", false, 5.95);
  tl.add(() => {
    stingCrtOff();
  }, 5.95);

  if (frame) {
    tl.to(
      frame,
      {
        scaleY: 0.008,
        backgroundColor: "#f4f7f2",
        borderColor: "#f4f7f2",
        duration: 0.22,
        ease: HARD,
        transformOrigin: "center center",
      },
      6.0,
    );
    tl.set(frame, { opacity: 0 }, 6.24);
  }

  if (line) {
    tl.fromTo(
      line,
      { scaleX: 1, opacity: 1 },
      { scaleX: 0.04, duration: 0.32, ease: HARD },
      6.18,
    );
    tl.to(line, { opacity: 0, duration: 0.08, ease: "none" }, 6.5);
  }
  if (dot) {
    tl.fromTo(
      dot,
      { scale: 1, opacity: 1 },
      { scale: 0, opacity: 0, duration: 0.4, ease: "power2.out" },
      6.45,
    );
  }

  layer("crt", false, 6.9);
  layer("black", true, 6.9);
  layer("kill", false, 6.95);

  tl.add(() => {
    callbacks.onElias(true);
  }, 7.15);
  tl.add(() => {
    callbacks.onElias(false);
  }, 8.15);

  tl.to({}, { duration: 0.85 }, 8.15);

  return {
    kill(): void {
      tl.kill();
      callbacks.onLayer("tear", false);
      callbacks.onLayer("rgb", false);
      callbacks.onLayer("shake", false);
      callbacks.onLayer("crt", false);
      if (blow) gsap.set(blow, { opacity: 0 });
      if (line) gsap.set(line, { opacity: 0, scaleX: 0 });
      if (dot) gsap.set(dot, { opacity: 0, scale: 0 });
    },
  };
}
