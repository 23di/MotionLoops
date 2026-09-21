import type { ControlMeta, DialConfig } from "dialkit";
import { motifPresets, type MotifPreset } from "./motif-catalog";
import type { EditorSchema } from "./editor-schema";

type Parameter={type:string;key:string;label:string;default:number|string|boolean;min?:number;max?:number;step?:number;unit?:string;group:string;options?:readonly {value:string;label:string}[]};
const productRecipeDefaults={
  vortex:{geometry:{turnCount:4}},
  circle:{geometry:{horizontalRadius:36}},
} as const;
export function motifFactor(key:string){return key==="scaleIntensity"?100:["xOffset","stackOffset"].includes(key)?1/5.6:1;}
export const motifControlConfig:DialConfig={cropAspect:{type:"select",default:"1:1",options:["natural","1:1","4:5","3:2","16:9","9:16"]}};
for(const preset of motifPresets)for(const parameter of preset.params as readonly Parameter[]){
  const factor=motifFactor(parameter.key);
  motifControlConfig[parameter.key]=parameter.type==="slider"?[Number(parameter.default)*factor,parameter.min!*factor,parameter.max!*factor,Math.max(.001,(parameter.step??.01)*factor)]:parameter.type==="toggle"?Boolean(parameter.default):{type:"select",default:String(parameter.default),options:[...(parameter.options??[])]};
}
export function motifDefaults(preset:MotifPreset):Record<string,number|string|boolean>{
  const defaults:Record<string,number|string|boolean>={cropAspect:preset.defaultCropAspect,cornerRadius:preset.defaultBorderRadius/10.8,...Object.fromEntries(preset.params.map(parameter=>[parameter.key,typeof parameter.default==="number"?parameter.default*motifFactor(parameter.key):parameter.default]))};
  if(preset.templateId==="LoopSwirlTemplate")defaults.turns=productRecipeDefaults.vortex.geometry.turnCount;
  if(preset.templateId==="LoopRingTemplate")defaults.radiusX=productRecipeDefaults.circle.geometry.horizontalRadius;
  return defaults;
}
export function motifEditor(preset:MotifPreset):EditorSchema{
  const params=preset.params as readonly Parameter[],quick=params.filter(param=>param.type==="select").slice(0,3).map(param=>`reference.${param.key}`);
  if(preset.templateId==="LoopSwirlTemplate")quick.push("reference.visibleCount","reference.spacing");
  if(preset.templateId==="LoopRingTemplate")quick.push("reference.radiusX","reference.radiusY");
  const overrides:Record<string,Partial<ControlMeta>>={"motion.duration":{min:.1,max:120,step:.1}};
  const labels:Record<string,string>={"motion.duration":"Cycle duration","reference.cornerRadius":"Corner radius (%)","reference.cropAspect":"Card aspect"};
  for(const parameter of params){
    const factor=motifFactor(parameter.key),path=`reference.${parameter.key}`;
    labels[path]=parameter.label+(factor!==1||parameter.unit==="%"?" (%)":parameter.unit==="°"?" (°)":"");
    overrides[path]=parameter.type==="slider"?{min:parameter.min!*factor,max:parameter.max!*factor,step:Math.max(.001,(parameter.step??.01)*factor)}:parameter.type==="select"?{options:[...(parameter.options??[])]}:{};
  }
  // Quick controls are shortcuts. Keep the same parameters in their full section.
  const group=(name:string)=>params.filter(param=>param.group===name).map(param=>`reference.${param.key}`);
  if(preset.templateId==="LoopSwirlTemplate")labels["reference.spacing"]="Gap";
  const sections=[{id:"motion",title:"Motion",paths:["motion.duration",...group("animation")]},{id:"geometry",title:"Geometry",paths:group("template")},{id:"appearance",title:"Appearance",paths:[...group("appearance"),"reference.cornerRadius","reference.cropAspect"]},{id:"other",title:"Other",paths:["other.scope","other.copyJson","other.pasteJson","other.resetSettings"]}].filter(section=>section.paths.length);
  return {geometry:[],quickDirection:false,quickControls:quick,sections,controls:sections.flatMap(section=>section.paths),overrides,labels};
}
