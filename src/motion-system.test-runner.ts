// @ts-ignore Test runner bundles Node builtins.
import assert from "node:assert/strict";
import {presetOptions} from "./types";
import {referencePresets,referenceDefinition} from "./reference-catalog";
import {freshPreset,motionFingerprint} from "./catalog";
import {referenceScene} from "./reference-engine";
import {fitSettingsToFrame,generateNodeKeyframes} from "./engine";
import {toMotionDocument,fromMotionDocument,documentValues,documentFromValues,validateMotionDocument,motionEditor,modelBindings} from "./motion-system";
import {parseSettingsJson,serializeSettingsJson} from "./settings-json";

const sources=[{width:120,height:160},{width:180,height:100},{width:90,height:150}];
for(const id of [...presetOptions.map(p=>p.value),...referencePresets.map(p=>p.id)]){
  const original=freshPreset(id),document=toMotionDocument(original);
  assert.equal(document.version,2);
  assert(!("reference" in document)&&!("geometry" in document),"Only one settings namespace");
  assert.equal(new Set(modelBindings(document.model).map(b=>b.id)).size,modelBindings(document.model).length,id+": no duplicate bindings");
  validateMotionDocument(document);
  assert.deepEqual(toMotionDocument(parseSettingsJson(serializeSettingsJson(original),freshPreset("circle"))),document,id+": canonical JSON round trip across models");
  assert.deepEqual(documentFromValues(documentValues(document)),document,id+": storage round trip");
  const restored=fromMotionDocument(document);
  assert.equal(motionFingerprint(original),motionFingerprint(restored),id+": migration must not create a false Current draft");
  const visible=motionEditor(document);
  assert(visible.sections.every(s=>["motion","cards","trajectory","other"].includes(s.id)));
  const fullIds=new Set(visible.sections.flatMap(section=>section.bindings.map(binding=>binding.id)));
  assert(visible.quick.every(binding=>fullIds.has(binding.id)),id+": quick controls remain available in full sections");
  const renamed=fromMotionDocument({...document,preset:"circle"});
  for(const seconds of [0,.13,1.4,original.motion.duration]){
    if(referenceDefinition(original)){
      assert.deepEqual(referenceScene(restored,sources,720,400,seconds),referenceScene(original,sources,720,400,seconds),id+": unchanged native scene");
      assert.deepEqual(referenceScene(restored,sources,720,400,seconds),referenceScene(renamed,sources,720,400,seconds),id+": identity-independent evaluator");
    }else{
      const trace=(s:typeof original)=>generateNodeKeyframes(fitSettingsToFrame(s,720,400,120,160,3),0,3);
      const a=trace(original),b=trace(restored);
      assert.equal(a.length,b.length);
      for(let i=0;i<a.length;i++)for(const key of ["x","y","z","scaleX","scaleY","opacity","rotation"] as const)
        assert(Math.abs(a[i][key]-b[i][key])<1e-8,id+": unchanged trajectory "+key);
    }
  }
}
assert.throws(()=>validateMotionDocument({version:99}),/version/);
const bad=toMotionDocument(freshPreset("circle"));bad.parameters.cycleDuration=NaN;
assert.throws(()=>validateMotionDocument(bad),/finite/);
for(const id of ["circle","reference-carousel-01"] as const){
  const extended=toMotionDocument(freshPreset(id));
  extended.parameters.cycleDuration=200;
  extended.parameters.cardSize=200;
  validateMotionDocument(extended);
  const config=modelBindings(extended.model).find(b=>b.id==="cycleDuration")!.config as number[];
  assert.equal(config[2],30);
  assert.equal(documentFromValues(documentValues(extended)).parameters.cycleDuration,200);
  const restored=parseSettingsJson(serializeSettingsJson(fromMotionDocument(extended)),freshPreset("circle"));
  assert.equal(restored.motion.duration,200,"Manual values survive JSON across models");
  assert.equal(toMotionDocument(restored).parameters.cardSize,200);
}
console.log("Unified motion system: all presets, adapter equivalence, storage, identity and validation passed");

for(const easing of [{type:"easing",ease:null},{type:"easing",ease:42},{type:"easing",ease:[-1,0,1,1]},{type:"easing",ease:[0,0,2,1]},{type:"easing",duration:Infinity},{type:"spring",bounce:NaN}]){
  const document=toMotionDocument(freshPreset("circle"));document.parameters.easing=easing as never;
  assert.throws(()=>validateMotionDocument(document),/Invalid/);
  const legacy=freshPreset("circle");legacy.motion.fullCycle=easing as never;
  assert.throws(()=>parseSettingsJson(JSON.stringify(legacy),freshPreset("circle")),undefined,"Legacy JSON must validate transitions too");
}
