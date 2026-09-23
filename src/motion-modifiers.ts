import type { MotionSettings } from "./types";

export const pulseDefaults = { radiusPulse: 0, scalePulse: 0, opacityPulse: 0, depthPulse: 0 };
export const bloomPulse = { radiusPulse: 0.92, scalePulse: 0, opacityPulse: 0, depthPulse: 0 };

export const orbitOneGeometry = {shape: "parametric" as const, orient3d: true, yAmplitude: .65,
  depth: 77.5, tilt: 42, circleRotation: -28, rotation: 0};
export const orbitOneAppearance = {cardSize: 30, nearScale: 1.24, farScale: .52, farOpacity: .25};

/** Upgrade the old Bloom shape/recipe to Orbit 01 with a radius pulse. */
export function migrateBloomSettings(settings: MotionSettings): MotionSettings {
  const oldShape=String(settings.geometry.shape)==="bloom";
  const oldRecipe=settings.motion.radiusPulse===.92&&settings.motion.scalePulse===.42&&
    settings.motion.opacityPulse===.3&&settings.motion.depthPulse===.35;
  if(!oldShape&&!oldRecipe)return settings;
  if(settings.preset==="bloom"||oldShape)return {...settings,
    motion:{...settings.motion,...bloomPulse},
    geometry:{...settings.geometry,...orbitOneGeometry,radiusX:50,radiusY:40,pathScale:1,depthAmplitude:1},
    appearance:{...settings.appearance,...orbitOneAppearance}};
  return {...settings,motion:{...settings.motion,...bloomPulse}};
}
