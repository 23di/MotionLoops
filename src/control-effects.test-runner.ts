// @ts-ignore Test runner bundles Node builtins.
import assert from "node:assert/strict";
import {freshPreset,settingsFromSaved} from "./catalog";
import {referencePresets} from "./reference-catalog";
import {presetOptions} from "./types";
import {toMotionDocument,fromMotionDocument,motionEditor,validateMotionDocument,modelBindings,type MotionDocument} from "./motion-system";
import {referenceScene} from "./reference-engine";
import {fitSettingsToFrame,generateNodeKeyframes} from "./engine";
import {cardBaseSize} from "./card-presentation";

assert.equal(typeof globalThis.structuredClone,"undefined","Exercise Figma's missing browser API");
const original=toMotionDocument(freshPreset("racetrack"));
const copied=validateMotionDocument(original);
(copied.parameters.easing as {ease:number[]}).ease[0]=.3;
copied.other.scope="children";
assert.equal((original.parameters.easing as {ease:number[]}).ease[0],0);
assert.equal(original.other.scope,"selection");
const fallback=freshPreset("racetrack"),saved=settingsFromSaved({},fallback);
saved.geometry.radiusX=1;
assert.equal(fallback.geometry.radiusX,60,"Restoring settings must not mutate defaults");

const sources=Array.from({length:9},(_,i)=>({width:100+i*13,height:180-i*5}));
function trace(document:MotionDocument):string {
  const settings=fromMotionDocument(document);
  if(document.model!=="trajectory")return JSON.stringify([.137,.67,1.23,2.91,4.1,
    ...Array.from({length:15},(_,i)=>(i+.37)/15*settings.motion.duration)]
    .map(time=>referenceScene(settings,sources,720,400,time)));
  return JSON.stringify(sources.slice(0,3).map((size,index)=>generateNodeKeyframes(
    fitSettingsToFrame(settings,720,400,size.width,size.height,sources.length),index,sources.length,
  )));
}
const presets=[...referencePresets.map(p=>p.id),...presetOptions.map(p=>p.value)];
let checks=0;
const ineffective:string[]=[];
for(const id of presets){
  const initial=toMotionDocument(freshPreset(id));
  // Also exercise controls revealed when Row scaling is enabled.
  const variants:MotionDocument[]=initial.model==="rfCarousel"?[initial,{...initial,parameters:{...initial.parameters,scaleCenter:"on"}},...(["ellipse","custom-path","parametric","racetrack"] as const).map(shape=>({...initial,parameters:{...initial.parameters,shape,queue_customPath:"[[0,0.2],[0.4,0.9],[1,0.3]]"}}))]:[initial];
  for(const document of variants){
    const editor=motionEditor(document),baseline=trace(document);
    for(const binding of [...editor.quick,...editor.sections.flatMap(section=>section.bindings)]){
      // These are native Figma effects, covered by the exporter integration test.
      // These are native Figma effects, or mode switches that reveal dependent
      // controls; their effect is covered by exporter/schema integration tests.
      if(["farBlur","frontShadow","orient3d"].includes(binding.id))continue;
      const config:any=binding.config,value=document.parameters[binding.id];
      const alternatives=Array.isArray(config)?[config[1],config[2],config[1]+(config[2]-config[1])*.01,(config[1]+config[2])/2]:
        typeof value==="boolean"?[!value]:config?.options?config.options.map((option:any)=>typeof option==="string"?option:option.value):
        config?.type==="easing"?[{type:"easing",duration:1,ease:[.42,0,.58,1]}]:
        config?.type==="text"?["[[0,0],[0.5,1],[1,0]]"]:[];
      assert(alternatives.length,`${id}: missing audit for ${binding.id}`);
      const changesOutput=alternatives.some((next:any)=>trace({...document,parameters:{...document.parameters,[binding.id]:next}})!==baseline);
      // A compact orbit can already fit at native card size. Exercise Fit
      // with an oversized path so its constraint is actually active.
      const constrainedFit=binding.id==="fit"&&trace({...document,parameters:{...document.parameters,radiusX:100,radiusY:100,fit:true}})!==
        trace({...document,parameters:{...document.parameters,radiusX:100,radiusY:100,fit:false}});
      const constrainedAdaptive=["adaptiveSize","shape_adaptiveSize"].includes(binding.id)&&(()=>{
        const enabled=fromMotionDocument({...document,parameters:{...document.parameters,[binding.id]:true}});
        const disabled=fromMotionDocument({...document,parameters:{...document.parameters,[binding.id]:false}});
        return cardBaseSize(enabled,720,400,400,100).width!==cardBaseSize(disabled,720,400,400,100).width;
      })();
      const pairedTilt=binding.id==="tiltStyle"&&trace({...document,parameters:{...document.parameters,cardTilt:25,tiltStyle:"alternate"}})!==
        trace({...document,parameters:{...document.parameters,cardTilt:25,tiltStyle:"off"}})||
        binding.id==="cardTilt"&&trace({...document,parameters:{...document.parameters,cardTilt:25,tiltStyle:"alternate"}})!==
        trace({...document,parameters:{...document.parameters,cardTilt:0,tiltStyle:"alternate"}});
      if(!changesOutput&&!constrainedFit&&!constrainedAdaptive&&!pairedTilt)ineffective.push(`${id}/${document.parameters.shape}: ${binding.id}`);
      checks++;
    }
  }
}
assert.equal(ineffective.length,0,`Visible controls without animation effect:\n${ineffective.join("\n")}`);
const row=toMotionDocument(freshPreset("reference-carousel-11"));
const ripple=toMotionDocument(freshPreset("tile-wave"));
assert(motionEditor(ripple).quick.some(binding=>binding.id==="spread"&&binding.label==="Gap (%)"));
for(const id of ["radiusX","radiusY","spread"]){
  const editor=motionEditor(ripple);
  assert(editor.quick.some(binding=>binding.id===id),`Ripple exposes ${id} in quick settings`);
  assert(editor.sections.some(section=>section.bindings.some(binding=>binding.id===id)),`Ripple keeps ${id} in full settings`);
}
const wideRipple={...ripple,parameters:{...ripple.parameters,spread:150}};
assert.equal(fromMotionDocument(validateMotionDocument(wideRipple)).geometry.itemSpread,1.5);
assert.notEqual(trace(wideRipple),trace(ripple),"Ripple gap must affect exported animation");
const swirl=toMotionDocument(freshPreset("reference-spiralimages"));
assert(motionEditor(swirl).quick.some(binding=>binding.id==="visibleCount"));
for(const visibleCount of [1,8,24,60]){
  const settings=fromMotionDocument({...swirl,parameters:{...swirl.parameters,visibleCount}});
  for(const time of [.137,.67,1.23])assert(referenceScene(settings,sources,720,400,time).length<=visibleCount);
}
assert.equal((modelBindings(row.model).find(binding=>binding.id==="visible")!.config as number[])[2],20);
for(const visible of [1,3,6]){
  const settings=fromMotionDocument({...row,parameters:{...row.parameters,visible}});
  for(const time of [.137,.67,1.23])assert(referenceScene(settings,sources,720,400,time).length<=visible);
}
console.log(`Control effects: ${checks} parameter changes across ${presets.length} presets passed without structuredClone`);
