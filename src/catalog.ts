import { builtInPresetTunings } from "./presets";
import type { MotionSettings, PresetId } from "./types";

// Legacy ids remain valid for JSON and existing Figma documents.
export const families: { name: string; description: string; variants: { id: PresetId; name: string }[] }[] = [
  { name: "Orbit", description: "Cards travel around a shared center", variants: [
    { id: "orbit-3d-ring", name: "Ring" }, { id: "orbit-3d-vertical", name: "Vertical" },
    { id: "orbit-3d-tilted", name: "Tilted" }, { id: "circle", name: "Flat" },
    { id: "depth-blur", name: "Soft focus" },
  ] },
  { name: "Path", description: "A continuous stream along a shaped path", variants: [
    { id: "path-wave", name: "Wave" }, { id: "racetrack", name: "Track" }, { id: "arc", name: "Arc" },
    { id: "orbit-3d-eight", name: "Figure eight" }, { id: "orbit-3d-helix", name: "Helix" },
  ] },
  { name: "Carousel", description: "Bring each card into focus", variants: [
    { id: "cover-flow", name: "Deck" }, { id: "vision", name: "Focus" }, { id: "focus-swap", name: "Step" },
  ] },
  { name: "Stack", description: "New cards land on top of a fading stack", variants: [
    { id: "falling-stack", name: "Fall" }, { id: "stack-shuffle", name: "Shuffle" },
  ] },
  { name: "Sphere", description: "A rotating cloud of cards", variants: [{ id: "orbit-3d-sphere", name: "Sphere" }] },
  { name: "Fan", description: "Spread a deck open and close it", variants: [{ id: "fan", name: "Fan" }] },
  { name: "Swing", description: "A layered deck sways in unison", variants: [{ id: "pendulum", name: "Swing" }] },
  { name: "Spiral", description: "Cards sweep in and out around the center", variants: [{ id: "vortex", name: "Spiral" }] },
  { name: "Field", description: "Multiple cards move through the frame", variants: [
    { id: "scatter", name: "Scatter" }, { id: "cylinder", name: "Rows" },
  ] },
];

export const familyFor = (id: PresetId) => families.find((family) => family.variants.some((variant) => variant.id === id))!;

export function freshPreset(id: PresetId, previous?: MotionSettings): MotionSettings {
  const tuning = builtInPresetTunings[id];
  return {
    preset: id,
    motion: { duration: 5, stagger: 0, keyframes: 32, direction: "clockwise", fullCycle: { type: "easing", ease: [0, 0, 1, 1] }, ...tuning.motion },
    geometry: {
      units: "percent", shape: "parametric", dynamicScale: true,
      customPath: "[[0,0.5],[1,0.5]]", radiusX: 50, radiusY: 40, circleRotation: 0,
      depth: 65, tilt: 0, turns: 1, rotation: 0, orient3d: false,
      xWave: "cos", yWave: "sin", depthWave: "sin", xFrequency: 1, yFrequency: 1, depthFrequency: 1,
      xAmplitude: 1, yAmplitude: 1, depthAmplitude: 1, xPhase: 0, yPhase: 0, depthPhase: 0, yOffset: 0,
      shapeAmount: 1, itemSpread: 1, depthFalloff: 1, ...tuning.geometry,
    },
    appearance: { nearScale: 1.25, farScale: 0.55, farOpacity: 0.28, fadeStart: 0, fadeEnd: 100,
      opacityCurve: "linear", facePath: false, farBlur: 0, frontShadow: 0, ...tuning.appearance },
    other: { centerBeforeApply: previous?.other.centerBeforeApply ?? true,
      scope: previous?.other.scope ?? "selection", serviceLayers: "4", ...tuning.other },
  };
}

export function visibleGeometry(settings: MotionSettings) {
  const shape = settings.geometry.shape;
  return {
    angle: settings.geometry.orient3d || shape === "ellipse",
    spread: ["deck", "falling-stack", "cylinder", "focus-deck"].includes(shape),
    amount: ["shuffle", "fan", "pendulum", "vortex"].includes(shape),
    width: !["falling-stack", "sphere"].includes(shape),
    height: !["falling-stack", "sphere"].includes(shape),
  };
}
