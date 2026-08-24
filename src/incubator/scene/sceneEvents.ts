export type IncubatorSceneTarget = "left" | "right" | "threshold" | "terminal";

export interface IncubatorSceneInteraction {
  target: IncubatorSceneTarget;
  kind: "hover" | "click";
  active?: boolean;
}

export interface IncubatorScreenAnchor {
  x: number;
  y: number;
  visible: boolean;
}

export interface IncubatorScreenAnchors {
  left: IncubatorScreenAnchor;
  right: IncubatorScreenAnchor;
  core: IncubatorScreenAnchor;
  terminal: IncubatorScreenAnchor;
  threshold: IncubatorScreenAnchor;
}
