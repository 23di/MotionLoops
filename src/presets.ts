import type { MotionSettings, LegacyPresetId as PresetId } from "./types";
import { orbitOneGeometry, orbitOneAppearance } from "./motion-modifiers";

export type PresetTuning = {
  preservePrecision?: boolean;
  motion?: Partial<MotionSettings["motion"]>;
  geometry: Partial<MotionSettings["geometry"]>;
  appearance: Partial<MotionSettings["appearance"]>;
  other?: Partial<MotionSettings["other"]>;
};

const parametric = (
  values: Partial<MotionSettings["geometry"]>,
): Partial<MotionSettings["geometry"]> => ({
  units: "percent",
  shape: "parametric",
  radiusX: 50,
  radiusY: 40,
  orient3d: false,
  xWave: "cos",
  yWave: "sin",
  depthWave: "sin",
  xFrequency: 1,
  yFrequency: 1,
  depthFrequency: 1,
  xAmplitude: 1,
  yAmplitude: 1,
  depthAmplitude: 1,
  xPhase: 0,
  yPhase: 0,
  depthPhase: 0,
  yOffset: 0,
  shapeAmount: 1,
  itemSpread: 1,
  depthFalloff: 1,
  ...values,
});

export const builtInPresetTunings: Record<PresetId, PresetTuning> = {
  crosscurrent: {
    motion: { duration: 8 },
    geometry: parametric({ shape: "crosscurrent", radiusX: 46, radiusY: 38, depth: 30, tilt: 0, rotation: 0 }),
    appearance: { nearScale: 1, farScale: 0.86, farOpacity: 1 },
  },
  bloom: {
    motion: { duration: 4, stagger: 0, radiusPulse: 1, scalePulse: .8, opacityPulse: 1, depthPulse: .6 },
    geometry: parametric({ ...orbitOneGeometry, shape: "ellipse", radiusX: 60, radiusY: 40,
      pathScale: .6, circleRotation: -13, tilt: -50, turns: 1 }),
    appearance: orbitOneAppearance,
  },
  "tile-wave": {
    motion: { duration: 7 },
    geometry: parametric({ shape: "tile-wave", radiusX: 42, radiusY: 36, depth: 20, tilt: 0, rotation: 0 }),
    appearance: { nearScale: 1, farScale: 0.78, farOpacity: 1 },
  },
  circle: {
    geometry: { ...parametric({ shape: "ellipse", depthAmplitude: 0.2 }), depth: 22.5, tilt: 0, rotation: 0 },
    appearance: { nearScale: 1.08, farScale: 0.82, farOpacity: 0.55 },
  },
  "path-wave": {
    geometry: {
      ...parametric({ shape: "custom-path", depthAmplitude: 0.35 }),
      customPath: "[[0.04,0.68],[0.16,0.43],[0.3,0.3],[0.45,0.55],[0.61,0.72],[0.78,0.42],[0.96,0.34]]",
      depth: 42.5,
      tilt: 0,
      rotation: 0,
    },
    appearance: { cardSize: 30, nearScale: 1.16, farScale: 0.68, farOpacity: 0.35, facePath: true },
  },
  vision: {
    geometry: parametric({
      xWave: "sin",
      xAmplitude: 0.92,
      yFrequency: 1,
      yAmplitude: 0.08,
      yPhase: 90,
      depthWave: "cos",
      depth: 85,
      tilt: 0,
      rotation: 0,
    }),
    appearance: { nearScale: 1.32, farScale: 0.5, farOpacity: 0.22 },
  },
  scatter: {
    geometry: parametric({ xFrequency: 2, xPhase: 40, yFrequency: 3, depth: 75, turns: 1, rotation: 10 }),
    appearance: { nearScale: 1.2, farScale: 0.5, farOpacity: 0.2 },
  },
  arc: {
    geometry: parametric({ yAmplitude: -1, yOffset: 0.35, depthAmplitude: 0.55, depth: 52.5, tilt: 0, rotation: 0 }),
    appearance: { nearScale: 1.18, farScale: 0.65, farOpacity: 0.3 },
  },
  "orbit-3d-ring": {
    geometry: parametric({ orient3d: true, yAmplitude: 0.22, depth: 70, tilt: 0, rotation: 0 }),
    appearance: { nearScale: 1.25, farScale: 0.55, farOpacity: 0.28 },
  },
  "orbit-3d-vertical": {
    geometry: parametric({ orient3d: true, xAmplitude: 0.22, depthWave: "cos", depth: 70, tilt: 0, rotation: 0 }),
    appearance: { nearScale: 1.22, farScale: 0.54, farOpacity: 0.26 },
  },
  "orbit-3d-tilted": {
    geometry: parametric(orbitOneGeometry),
    appearance: orbitOneAppearance,
  },
  "orbit-3d-compact": {
    preservePrecision: true,
    motion: { duration: 6, stagger: 0, fullCycle: { type: "easing", duration: 1, ease: [.17, .96, .68, .62] } },
    geometry: parametric({ ...orbitOneGeometry, radiusX: 60, radiusY: 12.5,
      depth: 24.21875, tilt: 15, circleRotation: -15, turns: 1, pathScale: 1,
      customPath: "[[0.04,0.68],[0.22,0.36],[0.48,0.48],[0.72,0.68],[0.96,0.34]]" }),
    appearance: { ...orbitOneAppearance, cardSize: 0 },
    other: { centerBeforeApply: true, serviceLayers: "2", scope: "selection" },
  },
  "orbit-3d-helix": {
    geometry: parametric({ orient3d: true, yFrequency: 2, yAmplitude: 0.72, depth: 75, tilt: 0, turns: 1, rotation: 0 }),
    appearance: { cardSize: 30, nearScale: 1.2, farScale: 0.48, farOpacity: 0.2 },
  },
  "orbit-3d-eight": {
    geometry: parametric({ orient3d: true, xWave: "sin", yFrequency: 2, yAmplitude: 0.62, depthWave: "cos", depth: 70, tilt: 0, rotation: 0 }),
    appearance: { cardSize: 30, nearScale: 1.2, farScale: 0.5, farOpacity: 0.22 },
  },
  "orbit-3d-sphere": {
    geometry: { ...parametric({ shape: "sphere", orient3d: true }), depth: 75, tilt: 0, rotation: 0 },
    appearance: { cardSize: 30, nearScale: 1.2, farScale: 0.46, farOpacity: 0.18 },
  },
  "cover-flow": {
    geometry: { ...parametric({ shape: "deck" }), depth: 75, tilt: 0, rotation: 0 },
    appearance: { nearScale: 1.28, farScale: 0.58, farOpacity: 0.2 },
  },
  "stack-shuffle": {
    geometry: { ...parametric({ shape: "shuffle" }), depth: 55, tilt: 0, rotation: 0 },
    appearance: { nearScale: 1.08, farScale: 0.74, farOpacity: 0.45 },
  },
  "falling-stack": {
    motion: { duration: 11, stagger: 0 },
    geometry: {
      ...parametric({ shape: "falling-stack" }),
      depth: 60,
      tilt: 0,
      rotation: 0,
      itemSpread: 0.72,
    },
    appearance: { nearScale: 1.04, farScale: 0.82, farOpacity: 0.42 },
    other: { serviceLayers: "4" },
  },
  cylinder: {
    geometry: { ...parametric({ shape: "cylinder" }), depth: 75, tilt: 0, rotation: 0 },
    appearance: { nearScale: 1.22, farScale: 0.5, farOpacity: 0.22 },
  },
  racetrack: {
    motion: { duration: 5, stagger: 0, direction: "clockwise", fullCycle: { type: "easing", duration: 1, ease: [0, 0, 1, 1] } },
    geometry: {
      ...parametric({ shape: "racetrack", radiusX: 60, radiusY: 90, orient3d: true, yAmplitude: 0.22 }),
      customPath: "[[0,0.5],[1,0.5]]",
      depth: 60,
      tilt: 6,
      turns: 1,
      rotation: 0,
      shapeAmount: 1,
      itemSpread: 1,
      depthFalloff: 1,
    },
    appearance: { cardSize: 30, nearScale: 1.6, farScale: 0.6, farOpacity: 0.28, fadeStart: 0, fadeEnd: 100, opacityCurve: "linear", farBlur: 0, frontShadow: 0, facePath: false },
    other: { centerBeforeApply: true, serviceLayers: "4", scope: "selection" },
  },
  fan: {
    geometry: { ...parametric({ shape: "fan" }), depth: 45, tilt: 0, rotation: 0 },
    appearance: { nearScale: 1.1, farScale: 0.72, farOpacity: 0.4 },
  },
  pendulum: {
    geometry: { ...parametric({ shape: "pendulum" }), depth: 40, tilt: 0, rotation: 0 },
    appearance: { nearScale: 1.08, farScale: 0.76, farOpacity: 0.5 },
  },
  vortex: {
    geometry: { ...parametric({ shape: "vortex" }), depth: 80, tilt: 0, turns: 1, rotation: 0 },
    appearance: { cardSize: 30, nearScale: 1.22, farScale: 0.44, farOpacity: 0.16 },
  },
  "focus-swap": {
    geometry: { ...parametric({ shape: "focus-deck" }), depth: 75, tilt: 0, rotation: 0 },
    appearance: { nearScale: 1.3, farScale: 0.58, farOpacity: 0.18 },
  },
  "depth-blur": {
    geometry: parametric({ orient3d: true, yAmplitude: 0.22, depth: 80, tilt: 0, rotation: 0 }),
    appearance: { nearScale: 1.28, farScale: 0.5, farOpacity: 0.16, farBlur: 16 },
    other: { serviceLayers: "2" },
  },
};
