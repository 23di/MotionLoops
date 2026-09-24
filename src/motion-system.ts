import type { ControlMeta, DialConfig } from "dialkit";
import { cloneData } from "./clone-data";
import { bloomPulse, defaultQueueEasing, migrateBloomSettings, pulseDefaults } from "./motion-modifiers";
import type { DialTransition, MotionSettings, PresetId } from "./types";
import { controls as compatibilityControls } from "./control-schema";
import { referencePresets, referenceDefinition } from "./reference-catalog";
import { referenceDefaults, referenceEditor } from "./reference-controls";
import { schemaForShape, editorPaths } from "./editor-schema";
import { recipeKey, recipePresentation } from "./preset-presentation";
import { editableVisibleMax } from "./motion-capabilities";

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
  "motion.radiusPulse":["radiusPulse","Radius pulse (%)","motion",100],
  "motion.scalePulse":["scalePulse","Scale pulse (%)","motion",100],
  "motion.opacityPulse":["opacityPulse","Opacity pulse (%)","motion",100],
  "motion.depthPulse":["depthPulse","Depth pulse (%)","motion",100],
  "motion.queueStep":["queueStep","Queue transition (%)","motion",100],
  "motion.queueEasing":["queueEasing","Queue easing","motion"],
  "geometry.pathScale":["pathScale","Path size (%)","trajectory",100],
  "motion.direction":["direction","Direction","motion"],
  "motion.fullCycle":["easing","Easing","motion"],
  "appearance.cardSize":["cardSize","Card size (%)","cards"],
  "appearance.adaptiveSize":["adaptiveSize","Adaptive card size","cards"],
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
  "geometry.offsetX":["offsetX","Offset X (%)","trajectory"],
  "geometry.offsetY":["offsetY","Offset Y (%)","trajectory"],
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
      radiusX:100,radiusY:100,offsetX:100,offsetY:100,pathScale:200,
    };
    config=[config[0],config[1],override?.max!==undefined?config[2]:caps[id]??Math.min(config[2],/angle|rotation|tilt|Phase|spin/i.test(id)?180:100),config[3]];
  }
  return {id,path:normalized,label:alias?.[1]??label??id.replace(/([A-Z])/g," $1").replace(/^./,s=>s.toUpperCase()),
    section:alias?.[2]??section??(path.startsWith("appearance.")?"cards":"trajectory"),factor,config,
    advanced:path.includes(".advanced.")};
}
const easePaths=["easeX1","easeY1","easeX2","easeY2"];
const definitions=new Map(referencePresets.map(p=>[recipeKey(p),p]));
function queueAppearanceBindings():Binding[]{
  return Object.keys(legacyConfig).filter(path=>path.startsWith("appearance.")).map(path=>{
    const binding=makeBinding(path);
    const neutral=path==="appearance.cardSize"?0:
      ["appearance.nearScale","appearance.farScale","appearance.farOpacity"].includes(path)?100:undefined;
    const config=path==="appearance.sizeBasis"?{...(binding.config as object),default:"row"}:
      neutral!==undefined&&Array.isArray(binding.config)?[neutral,...binding.config.slice(1)]:binding.config;
    return {...binding,id:"shape_"+binding.id,config,quick:false};
  });
}
/** Model capabilities, not preset-specific UI. */
function bindingsFor(model:string):Binding[]{
  if(model==="trajectory")return Object.keys(legacyConfig)
    .filter(path=>/^(motion|geometry|appearance)\./.test(path))
    .map(path=>makeBinding(path,undefined,path.startsWith("motion.")?"motion":undefined));
  const definition=definitions.get(model);
  if(!definition)throw new Error("Unsupported motion model: "+model);
  const schema=referenceEditor(definition.id);
  const bindings=[makeBinding("motion.duration"),...("params" in definition?[]:[model==="rfCarousel"
    ? {...makeBinding("motion.queueEasing"),id:"easing",label:"Easing"}
    : makeBinding("motion.fullCycle")])];
  if(model==="rfCarousel")bindings.push({...makeBinding("motion.queue"),id:"queueAnimation",config:true},makeBinding("motion.queueStep"),
    ...["radiusPulse","scalePulse","opacityPulse","depthPulse"].map(key=>makeBinding("motion."+key)));
  if(model==="rfStack")bindings.push({...makeBinding("motion.queue"),id:"queueAnimation",config:true});
  for(const [id] of Object.entries(referenceDefaults(definition.id))){
    if(easePaths.includes(id))continue;
    const path="reference."+id;
    const section=schema.sections?.find(section=>section.paths.includes(path))?.id;
    const binding={...makeBinding(path,schema.labels?.[path],
      section==="motion"?"motion":section==="appearance"||section==="style"?"cards":"trajectory",
      schema.overrides?.[path]),quick:schema.quickControls?.includes(path)};
    bindings.push(binding);
    if(model==="rfStack"&&id==="planeSize")
      bindings.splice(bindings.length-1,0,makeBinding("appearance.adaptiveSize",undefined,binding.section));
  }
  if(model==="rfCarousel"){
    const shape=makeBinding("geometry.shape");
    bindings.push({...shape,config:{...(shape.config as object),default:"line"}});
    for(const path of Object.keys(legacyConfig).filter(path=>path.startsWith("geometry.")&&path!=="geometry.shape")){
      const binding=makeBinding(path);
      // Preserve the reference model's existing geometry parameter names.
      bindings.push({...binding,id:"queue_"+binding.id,quick:false});
    }
    bindings.push(...queueAppearanceBindings());
  }
  if(model==="rfStack"){
    for(const path of ["geometry.shape","geometry.radiusX","geometry.radiusY","geometry.circleRotation","geometry.customPath"]){
      const binding=makeBinding(path);
      bindings.push(path==="geometry.shape"?{...binding,config:{...(binding.config as object),default:"line"}}:
        path==="geometry.circleRotation"?{...binding,config:[90,-180,180,1]}:binding);
    }
  }
  return bindings;
}
const models=["trajectory",...definitions.keys()];
const registry=new Map(models.map(model=>[model,bindingsFor(model)]));
export const motionModelOptions=models.map(model=>({value:model,
  label:model==="trajectory"?"Trajectory":recipePresentation[model]?.name??model}));
export function modelBindings(model:string):readonly Binding[]{
  const bindings=registry.get(model);
  if(!bindings)throw new Error("Unsupported motion model: "+model);
  return bindings;
}
/** Change the algorithm primitive while retaining every compatible setting. */
export function switchMotionModel(settings:MotionSettings,model:string,sourceCount?:number):MotionSettings{
  if(!registry.has(model))throw new Error("Unsupported motion model: "+model);
  const current=referenceDefinition(settings),currentModel=current?recipeKey(current):"trajectory";
  if(model===currentModel)return settings;
  const switched=cloneData(settings);
  switched.renderer=model==="trajectory"?"legacy":model;
  if(model==="trajectory"){
    delete switched.reference;
    return switched;
  }
  const definition=definitions.get(model)!;
  const reference=referenceDefaults(definition.id);
  for(const binding of modelBindings(model)){
    if(!binding.path.startsWith("reference."))continue;
    const key=binding.path.slice("reference.".length);
    const value=settings.reference?.[key],config=binding.config as any;
    if(value===undefined||!(key in reference))continue;
    if(Array.isArray(config)&&typeof value==="number"&&
      (!Number.isFinite(value)||value<Number(config[1])))continue;
    if(config?.type==="select"&&!config.options.some((option:any)=>
      (typeof option==="string"?option:option.value)===value))continue;
    if(typeof value===typeof reference[key])reference[key]=value;
  }
  switched.reference=reference;
  if(["rfStack","rfCarousel"].includes(model)&&sourceCount!==undefined)
    switched.reference.visible=Math.min(Number(switched.reference.visible),
      editableVisibleMax(sourceCount));
  return switched;
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
  settings=migrateBloomSettings(settings);
  const definition=referenceDefinition(settings),model=definition?recipeKey(definition):"trajectory";
  if(model==="rfCarousel"&&!settings.motion.queueEasing&&settings.reference&&
    easePaths.every(key=>typeof settings.reference![key]==="number"))
    settings={...settings,motion:{...settings.motion,queueEasing:{type:"easing",duration:1,
      ease:easePaths.map(key=>settings.reference![key]) as [number,number,number,number]}}};
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
  if(model!=="trajectory"&&model!=="rfCarousel"&&settings.reference&&easePaths.every(key=>typeof settings.reference![key]==="number")){
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
  return migrateBloomSettings(settings);
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
  if(model==="trajectory"&&values["parameters.queueEasing"]===undefined&&parameters.queueStep===68)
    parameters.queueStep=100;
  const other={...compatibilityBase().other};
  for(const key of Object.keys(other))if(values["other."+key]!==undefined)(other as any)[key]=values["other."+key];
  return {version:2,preset:(values.preset??"circle") as PresetId,model,parameters,other};
}
export function legacyParameterId(model:string,path:string):string|undefined{
  return modelBindings(model).find(binding=>binding.path===path.replace(".advanced.","."))?.id;
}
export function motionEditor(document:MotionDocument){
  const bindings=modelBindings(document.model);
  let visible:Binding[]=[...bindings];
  let pathEditor=false;
  if(document.model==="trajectory"){
    const settings=fromMotionDocument(document),schema=schemaForShape(settings),paths=editorPaths(schema);
    pathEditor=true;
    visible=bindings.filter(binding=>!binding.path.includes("keyframes")&&binding.path!=="geometry.units"&&
      binding.id!=="sizeBasis"&&binding.id!=="queue"&&
      (settings.motion.queue||!['queueStep','queueEasing'].includes(binding.id))&&
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
    if(settings.geometry.depthAmplitude===0)
      for(const id of ["depthWave","depthFrequency","depthPhase"])inactive.add(id);
    if(!settings.geometry.orient3d){
      inactive.add("tilt");
      if(!["ellipse","parametric"].includes(settings.geometry.shape))inactive.add("angle");
    }
    if(settings.geometry.shape==="vortex")inactive.add("depthFalloff");
    if(["deck","falling-stack"].includes(settings.geometry.shape))inactive.add("facePath");
    if(["crosscurrent","tile-wave"].includes(settings.geometry.shape))
      for(const id of ["fadeStart","fadeEnd","opacityCurve","facePath"])inactive.add(id);
    visible=visible.filter(binding=>!inactive.has(binding.id));
  }else if(document.model==="rfCarousel"){
    const settings=fromMotionDocument(document),paths=editorPaths(schemaForShape(settings));
    pathEditor=true;
    const shape=document.parameters.shape??"line";
    const rowSize=settings.appearance.sizeBasis==="row";
    const unused=new Set(["units","dynamicScale","offsetX","offsetY","depth","tilt","rotation","orient3d","turns","depthWave","depthFrequency","depthAmplitude","depthPhase","depthFalloff"]);
    visible=visible.filter(binding=>binding.id!=="queueAnimation"&&binding.id!=="queueStep"&&binding.id!=="shape_sizeBasis"&&
      (!settings.motion.queue||!binding.id.endsWith("Pulse"))&&
      (settings.motion.queue||!["transitionDuration","delay","stagger"].includes(binding.id))&&
      (rowSize?binding.id!=="shape_cardSize":binding.id!=="cardSize")&&
      (!binding.id.startsWith("shape_")||["shape_cardSize","shape_adaptiveSize"].includes(binding.id))&&
      (!binding.path.startsWith("geometry.") || shape!=="line"&&
      !unused.has(binding.path.split(".")[1])&&
      (paths.has(binding.path)||paths.has("geometry.advanced")&&/Wave|Frequency|Amplitude|Phase|yOffset/.test(binding.path))));
    visible=visible.filter(binding=>
      (document.parameters.scaleCenter==="on"||!["scaleFocus","frontScale"].includes(binding.id)));
    if(document.parameters.solo===true)visible=visible.filter(binding=>
      !["depthFade","tiltStyle","cardTilt"].includes(binding.id));
    const adaptiveIndex=visible.findIndex(binding=>binding.id==="shape_adaptiveSize");
    const sizeIndex=visible.findIndex(binding=>binding.id===(rowSize?"cardSize":"shape_cardSize"));
    if(adaptiveIndex>=0&&sizeIndex>=0){
      const [adaptive]=visible.splice(adaptiveIndex,1);
      visible.splice(visible.findIndex(binding=>binding.id===(rowSize?"cardSize":"shape_cardSize")),0,adaptive);
    }
  }else if(document.model==="rfStack"){
    pathEditor=true;
    visible=visible.filter(binding=>binding.id!=="queueAnimation"&&
      (document.parameters.shape!=="line"||!["radiusY","customPath"].includes(binding.id))&&
      (document.parameters.shape==="custom-path"||binding.id!=="customPath"));
  }else if(document.model==="rfFlicker"){
    const effect=document.parameters.effect;
    visible=visible.filter(binding=>
      (effect!=="off"||!["easing","transitionDuration","delay","scaleDir","driftDir","scaleAmount","driftAmount"].includes(binding.id))&&
      (effect==="scale"||!["scaleDir","scaleAmount"].includes(binding.id))&&
      (effect==="drift"||!["driftDir","driftAmount"].includes(binding.id)));
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
  const document=cloneData(input as MotionDocument);
  if(document.version!==2)throw new Error("Unsupported motion document version.");
  if(document.preset!=="tile-wave"&&!compatibilityControls.preset.options.some(option=>option.value===document.preset))throw new Error("Unsupported preset identity.");
  if(!document.parameters||typeof document.parameters!=="object"||!document.other)throw new Error("Incomplete motion document.");
  if(document.model==="trajectory"){
    if(document.parameters.shape==="bloom"){
      Object.assign(document.parameters,{shape:"parametric",radiusX:50,radiusY:40,pathScale:100,
        depth:77.5,tilt:42,angle:-28,rotation:0,orient3d:true,yAmplitude:.65,depthAmplitude:1,
        cardSize:30,frontScale:124,backScale:52,backOpacity:25});
      for(const [key,value] of Object.entries(bloomPulse))document.parameters[key]=value*100;
    }
    for(const [key,value] of Object.entries(pulseDefaults))document.parameters[key]??=value;
    document.parameters.pathScale??=100;
    document.parameters.offsetX??=0;
    document.parameters.offsetY??=0;
    document.parameters.sizeBasis??="standard";
    document.parameters.adaptiveSize??=true;
    document.parameters.queue??=false;
    if(document.parameters.queueEasing===undefined && document.parameters.queueStep===68)
      document.parameters.queueStep=100;
    document.parameters.queueStep??=100;
    document.parameters.queueEasing??={...defaultQueueEasing};
  }
  const bindings=modelBindings(document.model);
  if(document.model==="rfCarousel")for(const binding of bindings)
    if(binding.id==="queueAnimation"||binding.id==="queueStep"||binding.id==="tiltStyle"||binding.id==="shape"||binding.id.startsWith("queue_")||binding.id.startsWith("shape_")||
      binding.path.startsWith("motion.")&&binding.id.endsWith("Pulse"))document.parameters[binding.id]??=defaultOf(binding.config);
  if(document.model==="rfStack")document.parameters.adaptiveSize??=true;
  if(document.model==="rfStack"){
    document.parameters.queueAnimation??=true;
    document.parameters.shape??="line";
    document.parameters.angle??=90;
    document.parameters.exitFade??=0;
  }
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
