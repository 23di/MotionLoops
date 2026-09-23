// @ts-ignore Test runner bundles Node builtins.
import assert from "node:assert/strict";
import {presetOptions} from "./types";
import {referencePresets,referenceDefinition} from "./reference-catalog";
import {freshPreset,motionFingerprint} from "./catalog";
import {referenceScene} from "./reference-engine";
import {fitSettingsToFrame,generateNodeKeyframes} from "./engine";
import {toMotionDocument,fromMotionDocument,documentValues,documentFromValues,validateMotionDocument,motionEditor,modelBindings} from "./motion-system";
import {parseSettingsJson,serializeSettingsJson} from "./settings-json";
import {animationFor,animationOptions,applyAnimation} from "./animation-recipes";

const sources=[{width:120,height:160},{width:180,height:100},{width:90,height:150}];
assert.equal(animationFor(freshPreset("bloom")),"custom","Bloom keeps the user-tuned animation parameters");
for(const option of animationOptions){
  const base=freshPreset("circle");
  const selected=applyAnimation(base,option.value);
  assert.deepEqual(selected.geometry,base.geometry,"Animation selection preserves the chosen shape and dimensions");
  assert.equal(selected.motion.duration,base.motion.duration);
  assert.equal(animationFor(selected),option.value);
  const restored=fromMotionDocument(validateMotionDocument(toMotionDocument(selected)));
  assert.equal(animationFor(restored),option.value,"Animation choice survives JSON/settings round trips");
  if(option.value!=="continuous"&&option.value!=="queue"){
    const a=generateNodeKeyframes(base,0,3),b=generateNodeKeyframes(selected,0,3);
    assert(a.some((frame,i)=>(["x","y","z","scaleX","opacity"] as const).some(key=>
      Math.abs(frame[key]-b[i][key])>.01)),
    option.label+" visibly changes animation output");
  }
}
const rowSettings=freshPreset("reference-carousel-05");
assert.equal(animationFor(rowSettings),"queue");
const rowDocument=toMotionDocument(rowSettings);
const circleQueue=fromMotionDocument({...rowDocument,parameters:{...rowDocument.parameters,shape:"ellipse"}});
for(const time of [0,.17,1.13,2.6,4.8]){
  const line=referenceScene(rowSettings,sources,720,400,time);
  const curved=referenceScene(circleQueue,sources,720,400,time);
  assert.deepEqual(curved.map(({x,y,...card})=>card),line.map(({x,y,...card})=>card),
    "Queue shape changes preserve Row timing, ordering, focus sizes and fading");
  assert(curved.some((card,i)=>Math.hypot(card.x-line[i].x,card.y-line[i].y)>1));
  for(const card of curved){
    const rx=circleQueue.geometry.radiusX*720/100*(circleQueue.geometry.pathScale??1);
    const ry=circleQueue.geometry.radiusY*400/100*(circleQueue.geometry.pathScale??1);
    assert(Math.abs(((card.x-360)/rx)**2+((card.y-200)/ry)**2-1)<1e-6,"Queue follows selected ellipse");
  }
}
const queueRoundTrip=fromMotionDocument(validateMotionDocument(toMotionDocument(circleQueue)));
assert.deepEqual(referenceScene(queueRoundTrip,sources,720,400,1.13),referenceScene(circleQueue,sources,720,400,1.13));
const oldRowDocument={...rowDocument,parameters:{...rowDocument.parameters}};
for(const key of Object.keys(oldRowDocument.parameters))if(key==="shape"||key.startsWith("queue_"))delete oldRowDocument.parameters[key];
assert.equal(validateMotionDocument(oldRowDocument).parameters.shape,"line","Saved Row keeps original linear path");
assert.equal(applyAnimation(rowSettings,"pulse").geometry.shape,"custom-path");
const customAnimation=applyAnimation(freshPreset("circle"),"pulse-zoom");
customAnimation.motion.radiusPulse=.5;
assert.equal(animationFor(customAnimation),"custom","Manual adjustments show Custom");
const bloomSettings=freshPreset("bloom"),orbitOne=freshPreset("orbit-3d-tilted");

assert.deepEqual(bloomSettings.appearance,orbitOne.appearance,"Bloom and Orbit 01 share all card styling");
assert.equal(bloomSettings.motion.duration,4);
const oldRecipe={...bloomSettings,motion:{...bloomSettings.motion,radiusPulse:.92,scalePulse:.42,opacityPulse:.3,depthPulse:.35},
  geometry:{...bloomSettings.geometry,shape:"ellipse" as const,depthAmplitude:0}};
const upgraded=fromMotionDocument(toMotionDocument(oldRecipe));
assert.equal(upgraded.geometry.shape,"parametric","Older Bloom recipes still migrate independently of the new defaults");
assert.equal(upgraded.motion.scalePulse,0);
assert.equal(upgraded.motion.opacityPulse,0);
assert.equal(upgraded.motion.depthPulse,0);
const bloom=toMotionDocument(bloomSettings);
for(const [key,value] of Object.entries({cycleDuration:4,stagger:0,radiusPulse:100,scalePulse:80,
  opacityPulse:100,depthPulse:60,shape:"ellipse",radiusX:60,radiusY:40,pathScale:60,angle:-13,
  depth:77.5,tilt:-50,turns:1,orient3d:true,yAmplitude:.65,cardSize:30,frontScale:124,backScale:52,backOpacity:25}))
  assert.equal(bloom.parameters[key],value,"User Bloom setting: "+key);
assert.deepEqual(toMotionDocument(fromMotionDocument(validateMotionDocument(bloom))),bloom,"User Bloom settings survive reload exactly");
const shapeOptions=(modelBindings("trajectory").find(binding=>binding.id==="shape")!.config as {options:{value:string}[]}).options;
assert(!shapeOptions.some(option=>option.value==="bloom"),"Bloom is not a selectable shape");
const oldBloom:typeof bloom={...bloom,parameters:{...bloom.parameters,shape:"bloom",depthAmplitude:1}};
for(const key of ["radiusPulse","scalePulse","opacityPulse","depthPulse","pathScale"])delete oldBloom.parameters[key];
assert.equal(validateMotionDocument(oldBloom).parameters.radiusPulse,92,"Previously saved Bloom keeps radius animation");
const oldCircle=toMotionDocument(freshPreset("circle"));
for(const key of ["radiusPulse","scalePulse","opacityPulse","depthPulse","pathScale"])delete oldCircle.parameters[key];
assert.equal(validateMotionDocument(oldCircle).parameters.radiusPulse,0,"Old documents gain neutral modifiers");
for(const shape of ["ellipse","custom-path","parametric"] as const){
  const base=freshPreset("circle");base.geometry.shape=shape;
  const pulse={...base,motion:{...base.motion,radiusPulse:.92,scalePulse:.42}};
  const a=generateNodeKeyframes(base,0,3),b=generateNodeKeyframes(pulse,0,3);
  assert(Math.abs(a[0].scaleX-b[0].scaleX)>.1,"Pulse can be reused on "+shape);
}
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
