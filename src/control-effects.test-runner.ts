// @ts-ignore Test runner bundles Node builtins.
import assert from "node:assert/strict";
import {families,freshPreset,settingsFromSaved} from "./catalog";
import {activeReferencePresets} from "./reference-catalog";
import {toMotionDocument,fromMotionDocument,motionEditor,validateMotionDocument,modelBindings,type MotionDocument} from "./motion-system";
import {referenceScene} from "./reference-engine";
import {fitSettingsToFrame,generateNodeKeyframes} from "./engine";

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
  if(document.model!=="trajectory")return JSON.stringify([.137,.67,1.23,2.91,4.1].map(time=>referenceScene(settings,sources,720,400,time)));
  return JSON.stringify(sources.slice(0,3).map((size,index)=>generateNodeKeyframes(
    fitSettingsToFrame(settings,720,400,size.width,size.height,sources.length),index,sources.length,
  )));
}
const presets=[...activeReferencePresets.map(p=>p.id),...families.flatMap(f=>f.variants.map(v=>v.id))];
let checks=0;
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
      assert(alternatives.some((next:any)=>trace({...document,parameters:{...document.parameters,[binding.id]:next}})!==baseline),
        `${id}: visible control ${binding.id} has no animation effect`);
      checks++;
    }
  }
}
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
