import type { MotionSettings } from "./types";
import { pulseDefaults, bloomPulse, migrateBloomSettings } from "./motion-modifiers";

export const animationOptions = [
  { value: "queue", label: "Queue", parameters: { ...pulseDefaults } },
  { value: "continuous", label: "Continuous", parameters: { ...pulseDefaults } },
  { value: "pulse", label: "Pulse", parameters: { ...pulseDefaults, radiusPulse: 0.6 } },
  { value: "zoom", label: "Zoom", parameters: { ...pulseDefaults, scalePulse: 0.42 } },
  { value: "pulse-zoom", label: "Pulse + Zoom", parameters: { ...bloomPulse } },
  { value: "fade", label: "Fade", parameters: { ...pulseDefaults, opacityPulse: 0.8 } },
  { value: "depth-wave", label: "Depth wave", parameters: { ...pulseDefaults, depthPulse: 0.6 } },
];

export function animationFor(settings: MotionSettings): string {
  settings=migrateBloomSettings(settings);
  if (settings.motion.queue) return "queue";
  return animationOptions.filter(option=>option.value!=="queue").find(option => Object.entries(option.parameters).every(([key, value]) =>
    Math.abs((settings.motion[key as keyof typeof pulseDefaults] ?? 0) - value) < 1e-6,
  ))?.value ?? "custom";
}

export function applyAnimation(settings: MotionSettings, id: string): MotionSettings {
  const animation = animationOptions.find(option => option.value === id);
  if (!animation) return settings;
  const legacyQueueStep=id==="queue" && !settings.motion.queueEasing && settings.motion.queueStep===.68;
  return {...settings,motion:{...settings.motion,...animation.parameters,queue:id==="queue",
    ...(legacyQueueStep?{queueStep:1}:{})}};
}
