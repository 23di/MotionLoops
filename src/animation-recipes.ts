import type { MotionSettings } from "./types";
import { pulseDefaults, bloomPulse, migrateBloomSettings } from "./motion-modifiers";
import { referenceDefinition, referencePreset } from "./reference-catalog";
import { referenceDefaults } from "./reference-controls";

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
  if (referenceDefinition(settings)?.mode === "rfCarousel") return "queue";
  return animationOptions.filter(option=>option.value!=="queue").find(option => Object.entries(option.parameters).every(([key, value]) =>
    Math.abs((settings.motion[key as keyof typeof pulseDefaults] ?? 0) - value) < 1e-6,
  ))?.value ?? "custom";
}

export function applyAnimation(settings: MotionSettings, id: string): MotionSettings {
  const animation = animationOptions.find(option => option.value === id);
  if (!animation) return settings;
  if(id==="queue"&&referenceDefinition(settings)?.mode==="rfCarousel") return settings;
  if(id==="queue") return {...settings,renderer:"rfCarousel",
    reference:{...referenceDefaults("reference-carousel-05"),pathShape:settings.geometry.shape},
    motion:{...settings.motion,...pulseDefaults,duration:referencePreset("reference-carousel-05")!.duration}};
  const queued=referenceDefinition(settings)?.mode==="rfCarousel";
  const line=queued&&(settings.reference?.pathShape??"line")==="line";
  if(line){
    const travel=String(settings.reference?.direction??"right");
    const vertical=travel==="up"||travel==="down";
    return {...settings,renderer:"legacy",
      geometry:{...settings.geometry,shape:"custom-path",
        customPath:vertical?"[[0.5,1],[0.5,0]]":"[[0,0.5],[1,0.5]]",
        orient3d:false,tilt:0,circleRotation:0,rotation:0,
        depthAmplitude:0,turns:1},
      appearance:{...settings.appearance,nearScale:id==="depth-wave"?1.2:1,
        farScale:id==="depth-wave"?.8:1,farOpacity:1,
        farBlur:0,frontShadow:0,facePath:false},
      motion:{...settings.motion,...animation.parameters,stagger:0,
        direction:travel==="left"||travel==="down"?"counterclockwise":"clockwise",
        fullCycle:{type:"easing",duration:1,ease:[0,0,1,1]}}};
  }
  return {...settings,renderer:queued?"legacy":settings.renderer,
    motion:{...settings.motion,...animation.parameters}};
}
