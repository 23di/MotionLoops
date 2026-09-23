import { builtInPresetTunings } from "./presets";
import { cloneData } from "./clone-data";
import { schemaForShape, type EditorSchema } from "./editor-schema";
import { referencePreset, referenceDefinition, activeReferencePresets } from "./reference-catalog";
import { recipeKey } from "./preset-presentation";
import { preferredSettings } from "./preferred-numbers";
import { pulseDefaults } from "./motion-modifiers";
import { referenceEditor, referenceDefaults } from "./reference-controls";
import type { MotionSettings, PresetId } from "./types";
import { documentFromValues, fromMotionDocument, toMotionDocument } from "./motion-system";

// Legacy ids remain valid for JSON and existing Figma documents.
export const families: { name: string; description: string; variants: { id: PresetId; name: string }[] }[] = [
  { name: "Cilinder", description: "Cards travel around a shared center", variants: [
    { id: "orbit-3d-ring", name: "Spatial" }, { id: "circle", name: "Flat" },
  ] },
  { name: "Orbit 01", description: "Cards follow a tilted spatial orbit", variants: [{ id: "orbit-3d-tilted", name: "Tilted" }] },
  { name: "Orbit 02", description: "Cards travel through a double-loop orbit", variants: [{ id: "orbit-3d-helix", name: "Double loop" }] },
  { name: "Orbit 03", description: "Cards cross along a spatial figure eight", variants: [{ id: "orbit-3d-eight", name: "Figure eight" }] },
  { name: "Orbit 04", description: "A compact tilted orbit with a paced rotation", variants: [{ id: "orbit-3d-compact", name: "Compact" }] },
  { name: "Contour", description: "A continuous stream along a shaped path", variants: [
    { id: "path-wave", name: "Wave" },
  ] },
  { name: "Globe", description: "A rotating cloud of cards", variants: [{ id: "orbit-3d-sphere", name: "Globe" }] },
  { name: "Coil", description: "Cards sweep in and out around the center", variants: [{ id: "vortex", name: "Coil" }] },
  { name: "Bloom", description: "Cards gather, open like petals, then return", variants: [{ id: "bloom", name: "Bloom" }] },
  { name: "Racetrack", description: "Cards circulate around a wide spatial track", variants: [{ id: "racetrack", name: "Racetrack" }] },
];

export const familyFor = (id: PresetId) => families.find((family) => family.variants.some((variant) => variant.id === id))
  ?? { name: (activeReferencePresets.find(preset=>preset.id===id)??referencePreset(id))?.label ?? "Custom", description: "Previously saved motion", variants: [{id, name: (activeReferencePresets.find(preset=>preset.id===id)??referencePreset(id))?.label ?? "Saved motion"}] };

export function editorFor(settings: MotionSettings):EditorSchema {
  const reference=referenceDefinition(settings);
  if(reference)return referenceEditor(reference.id);
  const preset = builtInPresetTunings[settings.preset as keyof typeof builtInPresetTunings];
  return preset && settings.geometry.shape === preset.geometry.shape && preset.editor
    ? preset.editor : schemaForShape(settings);
}

export function freshPreset(id: PresetId, previous?: MotionSettings): MotionSettings {
  const settings=presetSettings(id, previous);
  return builtInPresetTunings[id as keyof typeof builtInPresetTunings]?.preservePrecision
    ? settings : preferredSettings(settings);
}

function presetSettings(id: PresetId, previous?: MotionSettings): MotionSettings {
  const reference=referencePreset(id);
  if(reference){
    const base=freshPreset("circle",previous);
    return {...base,preset:id,renderer:recipeKey(reference),reference:referenceDefaults(id),motion:{...base.motion,duration:reference.duration,fullCycle:{type:"easing",duration:1,ease:[.86,.14,.14,.86]}}};
  }
  const tuning = builtInPresetTunings[id as keyof typeof builtInPresetTunings];
  return {
    preset: id,
    renderer: "legacy",
    motion: { duration: 5, stagger: 0, keyframes: 32, direction: "clockwise", fullCycle: { type: "easing", duration: 1, ease: [0, 0, 1, 1] }, ...pulseDefaults, ...tuning.motion },
    geometry: {
      units: "percent", shape: "parametric", dynamicScale: true,
      pathScale: 1,
      customPath: "[[0,0.5],[1,0.5]]", radiusX: 50, radiusY: 40, circleRotation: 0,
      depth: 65, tilt: 0, turns: 1, rotation: 0, orient3d: false,
      xWave: "cos", yWave: "sin", depthWave: "sin", xFrequency: 1, yFrequency: 1, depthFrequency: 1,
      xAmplitude: 1, yAmplitude: 1, depthAmplitude: 1, xPhase: 0, yPhase: 0, depthPhase: 0, yOffset: 0,
      shapeAmount: 1, itemSpread: 1, depthFalloff: 1, ...tuning.geometry,
    },
    appearance: { cardSize: 58, nearScale: 1.25, farScale: 0.55, farOpacity: 0.28, fadeStart: 0, fadeEnd: 100,
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

// Stable comparison ignores selection scope and internal sampling density.
export function motionFingerprint(settings: MotionSettings): string {
  const document=toMotionDocument(settings);
  const {keyframes:_samples,...parameters}=document.parameters;
  const normalized = {model:document.model,parameters};
  return JSON.stringify(normalized, (_key, value) => value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value);
}

export function settingsFromSaved(values: Record<string, unknown>, fallback: MotionSettings): MotionSettings {
  if(values.version===2)return fromMotionDocument(documentFromValues(values));
  const result = cloneData(fallback);
  if (typeof values.preset === "string") result.preset = values.preset as PresetId;
  const definition=referencePreset(result.preset);
  result.renderer=typeof values.renderer==="string"?values.renderer:definition?recipeKey(definition):"legacy";
  result.appearance.cardSize=typeof values["appearance.cardSize"]==="number"?values["appearance.cardSize"]:0;
  const rendererDefinition=referenceDefinition(result);
  if(rendererDefinition){
    result.reference=referenceDefaults(rendererDefinition.id);
    for(const key of Object.keys(result.reference)){
      const value=values[`reference.${key}`];
      if(typeof value==="number"||typeof value==="string"||typeof value==="boolean")result.reference[key]=value;
    }
  }else delete result.reference;
  for (const group of ["motion", "geometry", "appearance", "other"] as const) {
    for (const key of Object.keys(result[group])) {
      const value = values[`${group}.${key}`] ?? values[`${group}.advanced.${key}`];
      if (value !== undefined) (result[group] as unknown as Record<string, unknown>)[key] = value;
    }
  }
  if (result.motion.fullCycle.type !== "spring") result.motion.fullCycle = { ...result.motion.fullCycle, duration: result.motion.fullCycle.duration || 1 };
  return result;
}
