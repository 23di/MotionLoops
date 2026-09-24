export const presetOptions = [
  { value: "crosscurrent", label: "Crosscurrent" },
  { value: "bloom", label: "Bloom" },
  { value: "circle", label: "Circle" },
  { value: "path-wave", label: "Path wave" },
  { value: "vision", label: "Vision focus" },
  { value: "scatter", label: "Scatter orbit" },
  { value: "arc", label: "Arc carousel" },
  { value: "orbit-3d-ring", label: "3D · Turntable" },
  { value: "orbit-3d-vertical", label: "3D · Vertical halo" },
  { value: "orbit-3d-tilted", label: "3D · Saturn tilt" },
  { value: "orbit-3d-compact", label: "Orbit 04" },
  { value: "orbit-3d-helix", label: "3D · Double helix" },
  { value: "orbit-3d-eight", label: "3D · Figure eight" },
  { value: "orbit-3d-sphere", label: "3D · Sphere" },
  { value: "cover-flow", label: "Cover Flow" },
  { value: "stack-shuffle", label: "Stack Shuffle" },
  { value: "falling-stack", label: "Falling Stack" },
  { value: "cylinder", label: "Cylinder" },
  { value: "racetrack", label: "Racetrack" },
  { value: "fan", label: "Fan" },
  { value: "pendulum", label: "Pendulum" },
  { value: "vortex", label: "Vortex" },
  { value: "focus-swap", label: "Focus Swap" },
  { value: "depth-blur", label: "Depth Blur" },
] as const;

export type LegacyPresetId = (typeof presetOptions)[number]["value"] | "tile-wave";
export type PresetId = LegacyPresetId | import("./reference-catalog").ReferencePresetId;
export type TargetScope = "selection" | "children" | "deep";
export type Direction = "clockwise" | "counterclockwise";
export type OpacityCurve = "linear" | "early" | "late" | "soft" | "sharp";
export type WaveFunction = "sin" | "cos";
export type GeometryUnits = "percent" | "pixels";
export type GeometryShape =
  | "line"
  | "crosscurrent"
  | "tile-wave"
  | "ellipse"
  | "custom-path"
  | "parametric"
  | "sphere"
  | "deck"
  | "shuffle"
  | "falling-stack"
  | "tunnel"
  | "cylinder"
  | "racetrack"
  | "focus-deck"
  | "fan"
  | "pendulum"
  | "vortex";

export type DialTransition =
  | {
      type: "spring";
      visualDuration?: number;
      bounce?: number;
      stiffness?: number;
      damping?: number;
      mass?: number;
    }
  | {
      type: "easing" | "tween";
      duration?: number;
      ease?: [number, number, number, number] | string;
    };

export type ServiceLayerCount = "0" | "2" | "3" | "4" | "5";

/** Evaluator/legacy-file adapter shape. UI and persistence use MotionDocument v2. */
export interface MotionSettings {
  renderer?: string;
  reference?: Record<string, number | string | boolean>;
  preset: PresetId;
  motion: {
    duration: number;
    stagger: number;
    keyframes: number;
    direction: Direction;
    fullCycle: DialTransition;
    radiusPulse?: number;
    scalePulse?: number;
    opacityPulse?: number;
    depthPulse?: number;
    queue?: boolean;
    queueStep?: number;
    queueEasing?: DialTransition;
  };
  geometry: {
    units: GeometryUnits;
    shape: GeometryShape;
    dynamicScale: boolean;
    customPath: string;
    radiusX: number;
    radiusY: number;
    offsetX?: number;
    offsetY?: number;
    pathScale?: number;
    circleRotation: number;
    depth: number;
    tilt: number;
    turns: number;
    rotation: number;
    orient3d: boolean;
    xWave: WaveFunction;
    yWave: WaveFunction;
    depthWave: WaveFunction;
    xFrequency: number;
    yFrequency: number;
    depthFrequency: number;
    xAmplitude: number;
    yAmplitude: number;
    depthAmplitude: number;
    xPhase: number;
    yPhase: number;
    depthPhase: number;
    yOffset: number;
    shapeAmount: number;
    itemSpread: number;
    depthFalloff: number;
  };
  appearance: {
    cardSize?: number;
    sizeBasis?: "standard" | "row";
    adaptiveSize?: boolean;
    nearScale: number;
    farScale: number;
    farOpacity: number;
    fadeStart: number;
    fadeEnd: number;
    opacityCurve: OpacityCurve;
    facePath: boolean;
    farBlur: number;
    frontShadow: number;
  };
  other: {
    centerBeforeApply: boolean;
    serviceLayers: ServiceLayerCount;
    depthSplit?: boolean;
    scope: TargetScope;
  };
}

export interface SelectionSummary {
  selected: number;
  names: string[];
  types: string[];
  targets: Record<TargetScope, TargetPreview>;
  appliedSettings: MotionSettings | null;
  appliedPreset: PresetId | null;
}

export interface TargetPreview {
  count: number;
  orbitCount: number;
  frameWidth: number;
  frameHeight: number;
  items: Array<{
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
  }>;
}

export type UiToPluginMessage =
  | { type: "apply"; settings: MotionSettings | import("./motion-system").MotionDocument }
  | { type: "clear"; scope: TargetScope }
  | { type: "refresh-selection" }
  | { type: "resize"; height: number };

export type PluginToUiMessage =
  | { type: "selection"; selection: SelectionSummary }
  | { type: "result"; kind: "success" | "error"; message: string; diagnostics?: string };
