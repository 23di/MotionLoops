import { presetOptions, type DialTransition, type MotionSettings } from "./types";
import { migrateBloomSettings } from "./motion-modifiers";
import { referencePreset, referencePresets, referenceDefinition } from "./reference-catalog";
import { recipeKey, recipePresentation } from "./preset-presentation";
import { referenceControls, referenceDefaults, referenceEditor } from "./reference-controls";
import { fromMotionDocument, toMotionDocument, validateMotionDocument, validateTransition } from "./motion-system";

const maximumSettingsJsonLength = 100_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeCompatible(template: unknown, incoming: unknown, path: string): unknown {
  if (typeof template === "number") {
    if (typeof incoming !== "number" || !Number.isFinite(incoming)) {
      throw new Error(`${path} must be a finite number.`);
    }
    return incoming;
  }
  if (typeof template === "string" || typeof template === "boolean") {
    if (typeof incoming !== typeof template) {
      throw new Error(`${path} has the wrong type.`);
    }
    return incoming;
  }
  if (Array.isArray(template)) {
    if (!Array.isArray(incoming) || incoming.length !== template.length ||
      incoming.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
      throw new Error(`${path} must contain ${template.length} finite numbers.`);
    }
    return [...incoming];
  }
  if (isRecord(template)) {
    if (!isRecord(incoming)) throw new Error(`${path} must be an object.`);
    const result: Record<string, unknown> = {};
    for (const [key, fallback] of Object.entries(template)) {
      result[key] = key in incoming
        ? mergeCompatible(fallback, incoming[key], `${path}.${key}`)
        : fallback;
    }
    return result;
  }
  return template;
}

function oneOf(value: string, values: readonly string[], path: string): void {
  if (!values.includes(value)) throw new Error(`${path} contains an unsupported value.`);
}

export function serializeSettingsJson(settings: MotionSettings): string {
  return JSON.stringify(toMotionDocument(settings), null, 2);
}

export function migrateSettingsToPercent(
  settings: MotionSettings,
  frameWidth = 720,
  frameHeight = 400,
): MotionSettings {
  if (settings.geometry.units === "percent") return settings;
  const width = frameWidth > 0 ? frameWidth : 720;
  const height = frameHeight > 0 ? frameHeight : 400;
  return {
    ...settings,
    geometry: {
      ...settings.geometry,
      units: "percent",
      radiusX: settings.geometry.radiusX / width * 100,
      radiusY: settings.geometry.radiusY / height * 100,
      offsetX: (settings.geometry.offsetX ?? 0) / width * 100,
      offsetY: (settings.geometry.offsetY ?? 0) / height * 100,
      depth: settings.geometry.depth / Math.min(width, height) * 100,
    },
  };
}

export function parseSettingsJson(text: string, current: MotionSettings): MotionSettings {
  if (!text.trim()) throw new Error("Clipboard is empty.");
  if (text.length > maximumSettingsJsonLength) throw new Error("Settings JSON is too large.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Clipboard does not contain valid JSON.");
  }
  let candidate = isRecord(parsed) && isRecord(parsed.settings) ? parsed.settings : parsed;
  if(isRecord(candidate)&&"version" in candidate)return fromMotionDocument(validateMotionDocument(candidate));
  if (!isRecord(candidate) || !isRecord(candidate.motion) || !isRecord(candidate.geometry) ||
    !isRecord(candidate.appearance) || !isRecord(candidate.other)) {
    throw new Error("This is not a Motion Loops settings JSON.");
  }

  if (!("units" in candidate.geometry)) {
    const geometry = candidate.geometry;
    candidate = {
      ...candidate,
      geometry: {
        ...geometry,
        units: "percent",
        radiusX: typeof geometry.radiusX === "number" ? geometry.radiusX / 7.2 : geometry.radiusX,
        radiusY: typeof geometry.radiusY === "number" ? geometry.radiusY / 4 : geometry.radiusY,
        depth: typeof geometry.depth === "number" ? geometry.depth / 4 : geometry.depth,
      },
    };
  }

  candidate=migrateBloomSettings(candidate as unknown as MotionSettings) as unknown as Record<string,unknown>;
  const incoming=candidate as Record<string,unknown>;
  const incomingMotion=incoming.motion as Record<string,unknown>;
  if("fullCycle" in incomingMotion)validateTransition(incomingMotion.fullCycle as MotionSettings["motion"]["fullCycle"]);
  if("queueEasing" in incomingMotion)validateTransition(incomingMotion.queueEasing as DialTransition);
  if(!("queueEasing" in incomingMotion)&&incomingMotion.queueStep===.68)incomingMotion.queueStep=1;
  const source=typeof incoming.preset==="string"?referencePreset(incoming.preset):undefined;
  const renderer=typeof incoming.renderer==="string"?incoming.renderer:source?recipeKey(source):"legacy";
  oneOf(renderer,["auto","legacy",...Object.keys(recipePresentation)],"settings.renderer");
  const template={...current,renderer,appearance:{...current.appearance,cardSize:0}};
  const definition=referenceDefinition({preset:String(incoming.preset),renderer});
  if(definition)template.reference=referenceDefaults(definition.id);
  else delete template.reference;
  const settings = mergeCompatible(template, candidate, "settings") as MotionSettings;
  if(definition?.mode==="rfStack"){
    // Legacy Stack JSON had these fields, but its renderer did not use them.
    settings.geometry.shape="line";
    settings.geometry.circleRotation=90;
    settings.motion.queue=true;
  }
  if(definition?.mode==="rfCarousel"&&!("queueEasing" in incomingMotion)&&isRecord(incoming.reference)){
    const keys=["easeX1","easeY1","easeX2","easeY2"];
    if(keys.every(key=>typeof (incoming.reference as Record<string,unknown>)[key]==="number"))
      settings.motion.queueEasing={type:"easing",duration:1,
        ease:keys.map(key=>(incoming.reference as Record<string,number>)[key]) as [number,number,number,number]};
  }
  if(settings.reference){
    const schema=referenceEditor(definition!.id);
    for(const [key,value] of Object.entries(settings.reference)){
      const control=referenceControls[key as keyof typeof referenceControls],override=schema.overrides?.[`reference.${key}`];
      if(typeof value==="number"&&Array.isArray(control)){
        const min=override?.min??control[1];
        if(value<min-1e-9)throw new Error(`settings.reference.${key} must be at least ${min}.`);
      }else if(typeof value==="string"&&typeof control==="object"&&!Array.isArray(control)&&"options"in control){
        const options=override?.options??control.options;
        oneOf(value,options.map(option=>typeof option==="string"?option:option.value),`settings.reference.${key}`);
      }
    }
    if(settings.motion.duration<=0)throw new Error("Cycle duration must be positive.");
  }
  oneOf(settings.preset, [...presetOptions,...referencePresets.map(p=>({value:p.id})),{value:"tile-wave"}].map((preset) => preset.value), "settings.preset");
  oneOf(settings.motion.direction, ["clockwise", "counterclockwise"], "settings.motion.direction");
  if((settings.appearance.cardSize??0)<0)throw new Error("Card size must be non-negative.");
  oneOf(settings.geometry.shape, [
    "line", "ellipse", "custom-path", "parametric", "sphere", "deck", "shuffle", "tunnel",
    "cylinder", "racetrack", "focus-deck", "fan", "pendulum", "vortex",
    "falling-stack", "crosscurrent", "tile-wave",
  ], "settings.geometry.shape");
  oneOf(settings.geometry.units, ["percent", "pixels"], "settings.geometry.units");
  for (const wave of [settings.geometry.xWave, settings.geometry.yWave, settings.geometry.depthWave]) {
    oneOf(wave, ["sin", "cos"], "settings.geometry wave");
  }
  oneOf(settings.appearance.opacityCurve, ["linear", "early", "late", "soft", "sharp"], "settings.appearance.opacityCurve");
  oneOf(settings.other.serviceLayers, ["0", "2", "3", "4", "5"], "settings.other.serviceLayers");
  oneOf(settings.other.scope, ["selection", "children", "deep"], "settings.other.scope");
  oneOf(settings.motion.fullCycle.type, ["spring", "easing", "tween"], "settings.motion.fullCycle.type");
  if(!("renderer" in incoming))delete settings.renderer;
  if(isRecord(incoming.appearance)&&!("cardSize" in incoming.appearance))delete settings.appearance.cardSize;
  validateTransition(settings.motion.fullCycle, toMotionDocument(settings).model);
  if(settings.motion.queueEasing)validateTransition(settings.motion.queueEasing, toMotionDocument(settings).model);
  return settings;
}
