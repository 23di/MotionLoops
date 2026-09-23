import type { ControlMeta } from "dialkit";
import type { GeometryShape, MotionSettings } from "./types";

export type EditorSchema = {
  sections?: {id:string;title:string;paths:string[]}[];
  quickControls?: string[];
  labels?: Record<string,string>;
  overrides?: Record<string,Partial<ControlMeta>>;
  quickDirection?: boolean;
  controls?: string[];
  geometry: string[];
  pathEditor?: boolean;
  directionLabels?: [string, string];
  quick?: string[];
};

const plane = ["radiusX", "radiusY", "circleRotation", "depth", "tilt", "rotation", "orient3d", "turns"];
const depthWave = ["depthWave", "depthFrequency", "depthAmplitude", "depthPhase"];
// Engine capabilities are data. Presets can override these without editor branches.
export const editorSchemas: Record<GeometryShape, EditorSchema> = {
  parametric: { geometry: [...plane, "advanced"], pathEditor: true, quick: ["geometry.circleRotation"] },
  ellipse: { geometry: [...plane, ...depthWave], pathEditor: true, quick: ["geometry.circleRotation"] },
  "custom-path": { geometry: [...plane, "customPath", ...depthWave], pathEditor: true },
  sphere: { geometry: plane, pathEditor: true, quick: ["geometry.circleRotation"] },
  deck: { geometry: [...plane.filter(key => key !== "rotation"), "shapeAmount", "itemSpread", "depthFalloff"] },
  shuffle: { geometry: [...plane, "shapeAmount", "itemSpread"] },
  "falling-stack": { geometry: ["radiusY", "circleRotation", "depth", "tilt", "orient3d", "turns", "itemSpread"], directionLabels: ["↓ Down", "↑ Up"] },
  tunnel: { geometry: [...plane, "shapeAmount"] },
  cylinder: { geometry: [...plane, "shapeAmount", "itemSpread"] },
  racetrack: { geometry: [...plane, "shapeAmount"] },
  "focus-deck": { geometry: [...plane, "shapeAmount", "itemSpread", "depthFalloff"] },
  fan: { geometry: [...plane, "shapeAmount", "itemSpread"] },
  pendulum: { geometry: [...plane, "shapeAmount", "itemSpread"] },
  vortex: { geometry: [...plane, "shapeAmount"] },
  crosscurrent: { geometry: plane },
  "tile-wave": {
    geometry: [...plane, "itemSpread"],
    quick: ["geometry.radiusX", "geometry.radiusY", "geometry.itemSpread"],
  },
};

export function editorPaths(schema: EditorSchema): Set<string> {
  return new Set(schema.controls ?? [
    "motion.duration", "motion.stagger", "motion.fullCycle",
    "motion.radiusPulse", "motion.scalePulse", "motion.opacityPulse", "motion.depthPulse",
    "geometry.pathScale",
    "geometry.shape", "geometry.dynamicScale",
    ...schema.geometry.map(key => `geometry.${key}`),
    "appearance", "other",
  ]);
}

export function selectControls(controls: ControlMeta[], paths: Set<string>): ControlMeta[] {
  return controls.flatMap(control => {
    if (paths.has(control.path)) return [control];
    if (!control.children) return [];
    const children = selectControls(control.children, paths);
    return children.length ? [{ ...control, children }] : [];
  });
}

export function schemaForShape(settings: MotionSettings): EditorSchema {
  return editorSchemas[settings.geometry.shape];
}
