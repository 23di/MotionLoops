import type { ControlMeta, DialConfig } from "dialkit";
import { cloneData } from "./clone-data";
import type { DialTransition, MotionSettings, PresetId } from "./types";
import { controls as compatibilityControls } from "./control-schema";
import { referencePresets, referenceDefinition } from "./reference-catalog";
import { referenceDefaults, referenceEditor } from "./reference-controls";
import { schemaForShape, editorPaths } from "./editor-schema";
import { recipeKey } from "./preset-presentation";

export type ParameterValue = number | string | boolean | DialTransition;
/** The only persisted/editor-facing settings format. Evaluators use adapters below. */
export interface MotionDocument {
  version: 2;
  preset: PresetId; // Provenance only; never selects an evaluator.
  model: string;
  parameters: Record<string, ParameterValue>;
  other: MotionSettings["other"];
}
export type Section = "motion" | "cards" | "trajectory" | "other";
export const motionSections: {id:Section;title:string}[] = [
  {id:"motion",title:"Motion"}, {id:"cards",title:"Cards"},
  {id:"trajectory",title:"Trajectory"}, {id:"other",title:"Other"},
];
type Binding = {
  id:string; path:string; label:string; section:Section; config:unknown;
  factor:number; quick?:boolean; advanced?:boolean;
};
const scalar = (value: unknown): value is ParameterValue =>
  typeof value==="number" || typeof value==="string" || typeof value==="boolean" ||
  !!value && typeof value==="object" && "type" in value;
const flatten = (value:unknown,prefix="",result:Record<string,unknown>={}):Record<string,unknown> => {
  if(!value || typeof value!=="object")return result;
  for(const [key,item] of Object.entries(value)){
    if(key.startsWith("_"))continue;
    const path=prefix?prefix+"."+key:key;
    if(Array.isArray(item)||scalar(item))result[path]=item;
    else flatten(item,path,result);
  }
  return result;
};
const legacyConfig=flatten(compatibilityControls);
const defaultOf=(control:any):any=>Array.isArray(control)?control[0]:
  control?.type==="easing"?{type:"easing",duration:control.duration||1,ease:control.ease}:
  control && typeof control==="object"?control.default:control;
function get(settings:MotionSettings,path:string):any {
  return path.split(".").reduce((value:any,key)=>value?.[key],settings);
}
function set(settings:MotionSettings,path:string,value:unknown){
  const parts=path.split("."),key=parts.pop()!;
  let cursor:any=settings;
  for(const part of parts)cursor=cursor[part]??(cursor[part]={});
  cursor[key]=value;
}
const aliases:Record<string,[string,string,Section,number?]>={
  "motion.duration":["cycleDuration","Cycle duration (s)","motion"],
  "motion.stagger":["stagger","Stagger (s)","motion"],
  "motion.direction":["direction","Direction","motion"],
  "motion.fullCycle":["easing","Easing","motion"],
  "appearance.cardSize":["cardSize","Card size (%)","cards"],
  "appearance.nearScale":["frontScale","Front scale (%)","cards",100],
  "appearance.farScale":["backScale","Back scale (%)","cards",100],
  "appearance.farOpacity":["backOpacity","Back opacity (%)","cards",100],
  "geometry.itemSpread":["spread","Spread (%)","trajectory",100],
  "reference.planeSize":["cardSize","Card size (%)","cards"],
  "reference.scaleIntensity":["cardSize","Card size (%)","cards"],
  "reference.gap":["spacing","Spacing (%)","trajectory"],
  "reference.duration":["transitionDuration","Transition duration (s)","motion"],
  "reference.easing":["easingStyle","Easing","motion"],
  "reference.delay":["delay","Pause (s)","motion"],
  "reference.stagger":["stagger","Stagger (s)","motion"],
  "reference.cornerRadius":["cornerRadius","Corner radius (%)","cards"],
  "reference.offsetX":["offsetX","Offset X (%)","trajectory"],
  "reference.offsetY":["offsetY","Offset Y (%)","trajectory"],
  "reference.xOffset":["offsetX","Offset X (%)","trajectory"],
  "reference.centerScale":["frontScale","Front scale (%)","cards",100],
  "reference.cropAspect":["aspect","Card aspect","cards"],
  "reference.imageFit":["imageFit","Image fit","cards"],
  "geometry.radiusX":["radiusX","Horizontal radius (%)","trajectory"],
  "geometry.radiusY":["radiusY","Vertical radius (%)","trajectory"],
  "geometry.circleRotation":["angle","Angle (°)","trajectory"],
  "geometry.tilt":["tilt","Tilt (°)","trajectory"],
  "geometry.depth":["depth","Depth (%)","trajectory"],
  "reference.tilt":["cardTilt","Card tilt","cards"],
  "geometry.rotation":["rotation","Card rotation (°)","cards"],
  "geometry.shape":["shape","Shape","trajectory"],
  "geometry.dynamicScale":["fit","Fit inside frame","cards"],
};
function makeBinding(path:string,label?:string,section?:Section,override?:Partial<ControlMeta>):Binding{
  const normalized=path.replace(".advanced.",".");
  const source=legacyConfig[path]??legacyConfig[normalized];
  const alias=aliases[normalized];
  const id=alias?.[0]??normalized.split(".").slice(1).join("_");
  const factor=alias?.[3]??1;
  let config:any=source;
  if(Array.isArray(source))config=[
    Number(source[0])*factor,(override?.min??Number(source[1]))*factor,
    (override?.max??Number(source[2]))*factor,(override?.step??Number(source[3]??.01))*factor,
  ];
  else if(override?.options && source && typeof source==="object")config={...source,options:override.options};
  if(id==="cycleDuration")config=[5,.1,30,.1];
  if(Array.isArray(config)){
    const caps:Record<string,number>={
      transitionDuration:10,delay:5,stagger:2,cycles:4,cardSize:100,
      frontScale:200,backScale:100,spacing:50,spread:150,depth:100,
      perspective:200,zoom:200,turns:4,visible:6,
      radiusX:100,radiusY:100,offsetX:100,offsetY:100,
    };
    config=[config[0],config[1],override?.max!==undefined?config[2]:caps[id]??Math.min(config[2],/angle|rotation|tilt|Phase|spin/i.test(id)?180:100),config[3]];
  }
  return {id,path:normalized,label:alias?.[1]??label??id.replace(/([A-Z])/g," $1").replace(/^./,s=>s.toUpperCase()),
    section:alias?.[2]??section??(path.startsWith("appearance.")?"cards":"trajectory"),factor,config,
    advanced:path.includes(".advanced.")};
}
const easePaths=["easeX1","easeY1","easeX2","easeY2"];
const definitions=new Map(referencePresets.map(p=>[recipeKey(p),p]));
/** Model capabilities, not preset-specific UI. */
function bindingsFor(model:string):Binding[]{
  if(model==="trajectory")return Object.keys(legacyConfig)
    .filter(path=>/^(motion|geometry|appearance)\./.test(path))
    .map(path=>makeBinding(path,undefined,path.startsWith("motion.")?"motion":undefined));
  const definition=definitions.get(model);
  if(!definition)throw new Error("Unsupported motion model: "+model);
  const schema=referenceEditor(definition.id);
  const bindings=[makeBinding("motion.duration"),...("params" in definition?[]:[makeBinding("motion.fullCycle")])];
  for(const [id] of Object.entries(referenceDefaults(definition.id))){
    if(easePaths.includes(id))continue;
    const path="reference."+id;
    const section=schema.sections?.find(section=>section.paths.includes(path))?.id;
    bindings.push({...makeBinding(path,schema.labels?.[path],
      section==="motion"?"motion":section==="appearance"||section==="style"?"cards":"trajectory",
      schema.overrides?.[path]),quick:schema.quickControls?.includes(path)});
  }
  return bindings;
}
const models=["trajectory",...definitions.keys()];
const registry=new Map(models.map(model=>[model,bindingsFor(model)]));
export function modelBindings(model:string):readonly Binding[]{
  const bindings=registry.get(model);
  if(!bindings)throw new Error("Unsupported motion model: "+model);
  return bindings;
}
function compatibilityBase():MotionSettings{
  const settings={preset:"circle",renderer:"legacy",motion:{keyframes:32},geometry:{},appearance:{},other:{}} as MotionSettings;
  for(const [path,control] of Object.entries(legacyConfig)){
    if(/^(motion|geometry|appearance|other)\./.test(path)&&!(control as any)?.type?.includes("action"))
      set(settings,path.replace(".advanced.","."),defaultOf(control));
  }
  return settings;
}
export function toMotionDocument(settings:MotionSettings):MotionDocument{
  const definition=referenceDefinition(settings),model=definition?recipeKey(definition):"trajectory";
  const parameters:MotionDocument["parameters"]={};
  for(const binding of modelBindings(model)){
    let value=get(settings,binding.path);
    if(binding.path==="appearance.cardSize"&&value===undefined)value=0;
    if(value===undefined)value=defaultOf(binding.config);
    else if(typeof value==="number")value*=binding.factor;
    if(binding.id==="easing"&&value?.type!=="spring")value={
      ...value,type:"easing",duration:Number.isFinite(value?.duration)&&value.duration>0?value.duration:1,
      ease:value?.ease??[0,0,1,1],
    };
    if(value!==undefined)parameters[binding.id]=value;
  }
  if(model!=="trajectory"&&settings.reference&&easePaths.every(key=>typeof settings.reference![key]==="number")){
    parameters.easing={type:"easing",duration:1,ease:easePaths.map(key=>settings.reference![key]) as [number,number,number,number]};
  }
  return {version:2,preset:settings.preset,model,parameters,other:{...settings.other}};
}
/** Compatibility adapter: no legacy settings are stored alongside the document. */
export function fromMotionDocument(document:MotionDocument):MotionSettings{
  const settings=compatibilityBase();
  settings.preset=document.preset;
  settings.renderer=document.model==="trajectory"?"legacy":document.model;
  settings.other={...document.other};
  if(document.model!=="trajectory")settings.reference=referenceDefaults(definitions.get(document.model)!.id);
  for(const binding of modelBindings(document.model)){
    let value=document.parameters[binding.id]??defaultOf(binding.config);
    if(typeof value==="number")value/=binding.factor;
    if(value!==undefined)set(settings,binding.path,value);
  }
  if(document.model!=="trajectory"){
    const ease=(document.parameters.easing as DialTransition)?.type==="easing"?
      (document.parameters.easing as {ease?:unknown}).ease:undefined;
    if(Array.isArray(ease))easePaths.forEach((key,index)=>settings.reference![key]=ease[index]);
  }
  return settings;
}
export function documentValues(document:MotionDocument):Record<string,unknown>{
  return {version:2,preset:document.preset,model:document.model,
    ...Object.fromEntries(Object.entries(document.parameters).map(([key,value])=>["parameters."+key,value])),
    ...Object.fromEntries(Object.entries(document.other).map(([key,value])=>["other."+key,value]))};
}
export function documentFromValues(values:Record<string,unknown>):MotionDocument{
  const model=String(values.model??"trajectory");
  const parameters:MotionDocument["parameters"]={};
  for(const binding of modelBindings(model)){
    const value=values["parameters."+binding.id]??defaultOf(binding.config);
    if(value!==undefined)parameters[binding.id]=value as ParameterValue;
  }
  const other={...compatibilityBase().other};
  for(const key of Object.keys(other))if(values["other."+key]!==undefined)(other as any)[key]=values["other."+key];
  return {version:2,preset:(values.preset??"circle") as PresetId,model,parameters,other};
}
export function legacyParameterId(model:string,path:string):string|undefined{
  return modelBindings(model).find(binding=>binding.path===path.replace(".advanced.","."))?.id;
}
export function motionEditor(document:MotionDocument){
  const bindings=modelBindings(document.model);
  let visible=bindings;
  let pathEditor=false;
  if(document.model==="trajectory"){
    const settings=fromMotionDocument(document),schema=schemaForShape(settings),paths=editorPaths(schema);
    pathEditor=!!schema.pathEditor;
    visible=bindings.filter(binding=>!binding.path.includes("keyframes")&&binding.path!=="geometry.units"&&
      (paths.has(binding.path)||paths.has(binding.path.split(".")[0])||binding.path==="motion.direction"||
       paths.has("geometry.advanced")&&/Wave|Frequency|Amplitude|Phase|yOffset/.test(binding.path)));
    const quickPaths=new Set(["motion.direction",...(schema.quick??[])]);
    visible=visible.map(binding=>({...binding,quick:quickPaths.has(binding.path)}));
    if(settings.geometry.shape==="tile-wave")
      visible=visible.map(binding=>binding.id==="spread"
        ? {...binding,label:"Gap (%)",quick:true,config:[100,0,200,1]}
        : binding);
    // Expose only controls consumed by this shape in its current mode.
    const inactive=new Set<string>();
    if(!settings.geometry.orient3d){
      inactive.add("tilt");
      if(!["ellipse","parametric"].includes(settings.geometry.shape))inactive.add("angle");
    }
    if(settings.geometry.shape==="vortex")inactive.add("depthFalloff");
    if(["crosscurrent","tile-wave"].includes(settings.geometry.shape))
      for(const id of ["fadeStart","fadeEnd","opacityCurve","facePath"])inactive.add(id);
    visible=visible.filter(binding=>!inactive.has(binding.id));
  }else if(document.model==="rfCarousel"){
    visible=visible.filter(binding=>binding.id!=="cardTilt"&&
      (document.parameters.scaleCenter==="on"||!["scaleFocus","frontScale"].includes(binding.id)));
  }
  const quick=visible.filter(binding=>binding.quick);
  return {quick,pathEditor,sections:motionSections.map(section=>({...section,
    // A quick control is duplicated intentionally: the canonical control remains
    // discoverable in the complete section for this model/shape.
    bindings:visible.filter(binding=>binding.section===section.id)})).filter(section=>section.bindings.length||section.id==="other")};
}
const parameterControls:Record<string,any>={};
for(const bindings of registry.values())for(const binding of bindings){
  const config=binding.config;
  // Storage must not clamp or quantize manually entered values on reload.
  // The editor supplies the model's normal slider range separately.
  parameterControls[binding.id]=Array.isArray(config)?[config[0],-Number.MAX_VALUE,Number.MAX_VALUE,0]:config;
}
export const motionControls={
  version:[2,2,2],preset:compatibilityControls.preset,
  model:{type:"select",options:models,default:"trajectory"},
  parameters:parameterControls,other:compatibilityControls.other,
} satisfies DialConfig;

export function validateMotionDocument(input:unknown):MotionDocument{
  if(!input||typeof input!=="object")throw new Error("Invalid motion document.");
  const document=input as MotionDocument;
  if(document.version!==2)throw new Error("Unsupported motion document version.");
  if(!compatibilityControls.preset.options.some(option=>option.value===document.preset))throw new Error("Unsupported preset identity.");
  if(!document.parameters||typeof document.parameters!=="object"||!document.other)throw new Error("Incomplete motion document.");
  const bindings=modelBindings(document.model);
  for(const binding of bindings){
    const value=document.parameters[binding.id],config:any=binding.config;
    if(value===undefined)throw new Error("Missing parameter: "+binding.id);
    if(Array.isArray(config)){
      if(typeof value!=="number"||!Number.isFinite(value))throw new Error(binding.label+" must be finite.");
      if(value<config[1]-1e-9)throw new Error(binding.label+" is below its minimum.");
    }else if(config?.type==="select"){
      if(!config.options.some((option:any)=>(typeof option==="string"?option:option.value)===value))throw new Error("Unsupported "+binding.label);
    }else if(config?.type==="easing"){
      validateTransition(value as DialTransition, document.model);
    }else if(config?.type==="text"){
      if(typeof value!=="string")throw new Error("Invalid "+binding.label);
    }else if(typeof value!==typeof config)throw new Error("Invalid "+binding.label);
  }
  if(!["selection","children","deep"].includes(document.other.scope))throw new Error("Unsupported selection scope.");
  if(!["0","2","3","4","5"].includes(document.other.serviceLayers)||typeof document.other.centerBeforeApply!=="boolean")throw new Error("Invalid output settings.");
  return cloneData(document);
}

export function validateTransition(transition: DialTransition, model = "trajectory"): void {
  if(!transition||!["easing","tween","spring"].includes(transition.type))throw new Error("Invalid easing.");
  if(model!=="trajectory"&&transition.type==="spring")throw new Error("This motion model supports Bézier easing, not spring physics.");
  if(transition.type==="spring"){
    for(const key of ["bounce","visualDuration","stiffness","damping","mass"] as const){
      const value=transition[key];
      if(value!==undefined&&(typeof value!=="number"||!Number.isFinite(value)))throw new Error("Invalid spring "+key+".");
    }
  }else{
    const ease=transition.ease;
    if(ease!==undefined&&typeof ease!=="string"&&!Array.isArray(ease))throw new Error("Invalid easing coordinates.");
    if(Array.isArray(ease)&&(ease.length!==4||ease.some(n=>typeof n!=="number"||!Number.isFinite(n))||ease[0]<0||ease[0]>1||ease[2]<0||ease[2]>1))throw new Error("Invalid easing coordinates.");
    if(transition.duration!==undefined&&(!Number.isFinite(transition.duration)||transition.duration<=0))throw new Error("Invalid easing duration.");
  }
}
