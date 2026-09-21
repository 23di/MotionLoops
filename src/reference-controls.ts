import type { DialConfig } from "dialkit";
import { referencePreset } from "./reference-catalog";
import type { EditorSchema } from "./editor-schema";
import { motifControlConfig, motifDefaults, motifEditor } from "./motif-controls";
import { preferredSettings } from "./preferred-numbers";

const select=(values:string[],value=values[0])=>({type:"select" as const,options:values,default:value});
// Product recipe data uses Orbit's own vocabulary. Imported renderer snapshots
// remain an implementation detail for backwards-compatible saved documents.
const productRecipeDefaults={
  row:{motion:{travel:"right"},appearance:{edgeShade:50}},
} as const;
export const referenceControls = {
  ...motifControlConfig,
  _collapsed:true,
  planeSize:[100,1,200,1], cornerRadius:[0,0,50,.1],
  offsetX:[0,-100,100,.5],offsetY:[0,-100,100,.5],
  zoom:[150,50,300,1],perspective:[50,0,1000,1],visible:[3,2,8,1],
  duration:[2,.1,60,.05],delay:[0,0,5,.05],cycles:[1,.25,8,.25],stagger:[0,0,3,.001],
  direction:select(["down","up","left","right"]),
  gap:[4,0,200,.1],centerScale:[1.4,1,4,.05],scaleCenter:select(["off","on"]),scaleFocus:select(["left","center","right"],"right"),tiltStyle:select(["off","fan","uniform","alternate"]),tilt:[0,-100,100,1],solo:false,depthFade:[0,0,100,1],
  effect:select(["off","scale","drift"]),pacing:select(["equal","eased"]),
  scaleDir:select(["forward","reverse"]),driftDir:select(["up","down","left","right"]),
  scaleAmount:[30,0,100,1],driftAmount:[30,0,200,1],
  scaleStyle:select(["bloom","recede"]),growFrom:select(["center","top","bottom","left","right"]),
  imageFit:select(["fit","fill"]),spin:[0,-180,180,5],
  easeX1:[.86,0,1,.01],easeY1:[.14,0,1,.01],easeX2:[.14,0,1,.01],easeY2:[.86,0,1,.01],
} satisfies DialConfig;

const shared=["planeSize","cornerRadius","easeX1","easeY1","easeX2","easeY2"];
export const referenceControlKeys={
  rfCarousel:[...shared,"gap","visible","offsetX","offsetY","direction","duration","delay","cycles","stagger","centerScale","scaleCenter","scaleFocus","tilt","solo","depthFade"],
  rfStack:[...shared,"offsetX","offsetY","zoom","perspective","visible","direction","duration","delay","cycles","stagger"],
  rfFlicker:[...shared,"offsetX","offsetY","effect","pacing","scaleDir","driftDir","scaleAmount","driftAmount","duration","delay","cycles"],
  rfScale:[...shared,"duration","stagger","scaleStyle","growFrom","imageFit","spin"],
};

export function referenceDefaults(id:string):Record<string,number|string|boolean>{
  const preset=referencePreset(id);
  if(!preset)return {};
  if("params" in preset)return preferredSettings(motifDefaults(preset));
  const defaults:Record<string,number|string|boolean>={};
  for(const key of referenceControlKeys[preset.mode]){
    const control=referenceControls[key as keyof typeof referenceControls];
    if(Array.isArray(control))defaults[key]=control[0];
    else if(typeof control==="object"&&"default"in control)defaults[key]=control.default;
    else if(typeof control==="boolean")defaults[key]=control;
  }
  const values=preset.values as Record<string,number|string|boolean>;
  for(const key of Object.keys(defaults))if(key in values)defaults[key]=values[key];
  // Translate the product recipe schema into renderer controls at the boundary.
  if(preset.mode==="rfCarousel"){
    defaults.direction=productRecipeDefaults.row.motion.travel;
    defaults.scaleFocus=values.scaleFocus==="start"?"left":values.scaleFocus==="center"?"center":"right";
    defaults.visible=6;
    if(typeof values.depthFade==="number")defaults.depthFade=productRecipeDefaults.row.appearance.edgeShade;
    if(id==="reference-carousel-05"||id==="reference-carousel-06"){
      defaults.scaleCenter="on";defaults.scaleFocus="center";defaults.centerScale=1.6;defaults.depthFade=25;
    }
  }
  // Source corner radius is in a 1080-high reference canvas. Store percentages.
  defaults.cornerRadius=Number(values.cornerRadius??0)/1080*100;
  if(preset.mode==="rfCarousel")for(const key of ["planeSize","gap"])defaults[key]=Number(values[key]??0)/1080*100;
  return preferredSettings(defaults);
}

export function referenceEditor(id:string):EditorSchema{
  const preset=referencePreset(id)!;
  if("params" in preset)return motifEditor(preset);
  const mode=preset.mode,keys=referenceControlKeys[mode];
  const quick={rfCarousel:["direction","scaleFocus","gap","visible"],rfStack:["direction"],rfFlicker:["effect","pacing"],rfScale:["scaleStyle","growFrom"]}[mode];
  const geometry=["planeSize","cornerRadius","offsetX","offsetY","zoom","perspective","visible","gap"];
  const timing=["duration","delay","cycles","stagger"];
  const easing=["easeX1","easeY1","easeX2","easeY2"];
  // Quick controls are shortcuts. Keep the same parameters in their full section.
  const paths=(items:string[])=>items.filter(key=>keys.includes(key)).map(key=>`reference.${key}`);
  const other=["other.scope","other.copyJson","other.pasteJson","other.resetSettings"];
  const sections=[{id:"motion",title:"Motion",paths:["motion.duration",...paths(timing)]},{id:"geometry",title:"Geometry",paths:paths(geometry)},{id:"style",title:"Style",paths:paths(keys.filter(key=>![...timing,...geometry,...easing].includes(key)))},{id:"easing",title:"Easing",paths:paths(easing)},{id:"other",title:"Other",paths:other}].filter(section=>section.paths.length>0);
  return {geometry:[],pathEditor:false,quickDirection:false,sections,quickControls:quick.map(key=>`reference.${key}`),controls:[...sections.flatMap(section=>section.paths)],overrides:{"motion.duration":{min:.1,max:120,step:.1},"reference.direction":{options:mode==="rfStack"?["down","up"]:["up","down","left","right"]},...(mode==="rfCarousel"?{"reference.visible":{min:1,max:20,step:1}}:{})},labels:{"motion.duration":"Cycle duration","reference.duration":"Transition duration","reference.scaleFocus":"Scale focus","reference.visible":"Visible cards","reference.planeSize":"Card size (%)","reference.gap":"Gap (%)","reference.cornerRadius":"Corner radius (%)","reference.offsetX":"Offset X (%)","reference.offsetY":"Offset Y (%)","reference.zoom":"Zoom (%)","reference.scaleAmount":"Scale amount (%)","reference.driftAmount":"Drift amount (%)","reference.depthFade":"Depth fade (%)"}};
}
