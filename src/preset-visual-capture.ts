import {presetOptions} from "./types";
import {freshPreset} from "./catalog";
import {referencePresets,referenceDefinition} from "./reference-catalog";
import {referenceScene} from "./reference-engine";
import {fitSettingsToFrame,generateNodeKeyframes,sampleGeneratedKeyframes} from "./engine";

/** Sample the same settings path used by the preview for every saved preset. */
export function capturePresetVisuals():Record<string,unknown>{
  const ids=[...presetOptions.map(option=>option.value),...referencePresets.map(preset=>preset.id)];
  const sizes=[{width:120,height:160},{width:80,height:120},{width:140,height:90},
    {width:100,height:100},{width:135,height:180},{width:90,height:130}];
  const linear={type:"easing" as const,duration:1,ease:[0,0,1,1] as [number,number,number,number]};
  return Object.fromEntries(ids.map(id=>{
    const settings=freshPreset(id),times=[0,.17,.37,.63,.89].map(phase=>phase*settings.motion.duration);
    const trace=referenceDefinition(settings)
      ? times.map(time=>referenceScene(settings,sizes,720,400,time))
      : sizes.map((size,index)=>{
        const fitted=fitSettingsToFrame(settings,720,400,size.width,size.height,sizes.length);
        const frames=generateNodeKeyframes(fitted,index,sizes.length);
        return times.map(time=>sampleGeneratedKeyframes(frames,time,linear));
      });
    return [id,trace];
  }));
}
