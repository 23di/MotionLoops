// @ts-ignore Test runner bundles Node builtins.
import assert from "node:assert/strict";
import {presetOptions} from "./types";
import {referencePresets,referenceDefinition} from "./reference-catalog";
import {families,freshPreset,motionFingerprint,settingsFromSaved} from "./catalog";
import {referenceScene} from "./reference-engine";
import {fitSettingsToFrame,generateNodeKeyframes,sampleGeneratedKeyframes} from "./engine";
import {toMotionDocument,fromMotionDocument,documentValues,documentFromValues,validateMotionDocument,motionEditor,modelBindings,motionModelOptions,switchMotionModel} from "./motion-system";
import {parseSettingsJson,serializeSettingsJson} from "./settings-json";
import {animationFor,animationOptions,applyAnimation} from "./animation-recipes";
import {cardBaseSize,cardGapPx} from "./card-presentation";
import {editableVisibleMax} from "./motion-capabilities";
import {compileReference} from "./reference-tracks";

const sources=[{width:120,height:160},{width:180,height:100},{width:90,height:150}];
assert.equal(animationFor(freshPreset("bloom")),"custom","Bloom keeps the user-tuned animation parameters");
for(const id of [...presetOptions.map(preset=>preset.value),
  ...referencePresets.filter(preset=>preset.mode==="rfCarousel").map(preset=>preset.id)]){
  const base=freshPreset(id),model=toMotionDocument(base).model;
  for(const option of animationOptions){
    const selected=applyAnimation(base,option.value);
    assert.equal(selected.renderer,base.renderer,id+" → "+option.value+": animation keeps renderer");
    assert.deepEqual(selected.reference,base.reference,id+" → "+option.value+": animation keeps layout settings");
    assert.deepEqual(selected.geometry,base.geometry,id+" → "+option.value+": animation keeps shape");
    assert.deepEqual(selected.appearance,base.appearance,id+" → "+option.value+": animation keeps cards");
    assert.deepEqual(selected.other,base.other,id+" → "+option.value+": animation keeps output settings");
    assert.equal(toMotionDocument(selected).model,model,id+" → "+option.value+": animation keeps model");
    const restored=fromMotionDocument(validateMotionDocument(toMotionDocument(selected)));
    assert.equal(animationFor(restored),option.value,id+" → "+option.value+": animation survives JSON");
    for(const next of animationOptions){
      const switched=applyAnimation(restored,next.value);
      assert.equal(toMotionDocument(switched).model,model,id+" → "+option.value+" → "+next.value+": model stays fixed");
      assert.deepEqual(switched.geometry,base.geometry,id+" → "+next.value+": shape stays fixed");
      assert.deepEqual(switched.appearance,base.appearance,id+" → "+next.value+": cards stay fixed");
      assert.deepEqual(switched.reference,base.reference,id+" → "+next.value+": layout stays fixed");
      assert.equal(animationFor(fromMotionDocument(validateMotionDocument(toMotionDocument(switched)))),next.value,
        id+" → "+option.value+" → "+next.value+": animation survives reload");
    }
  }
}
const bloomQueue=applyAnimation(freshPreset("bloom"),"queue");
const bloomQueueDocument=toMotionDocument(bloomQueue);
assert.equal(bloomQueueDocument.model,"trajectory","Bloom Queue uses Bloom's geometry engine");
for(const [key,value] of Object.entries({shape:"ellipse",radiusX:60,radiusY:40,tilt:-50,depth:77.5,
  cardSize:30,frontScale:124,backScale:52,backOpacity:25,queue:true}))
  assert.equal(bloomQueueDocument.parameters[key],value,"Bloom Queue preserves "+key);
assert.equal(referenceDefinition(bloomQueue),undefined,"Bloom Queue never loads Row's native renderer");
assert(!Object.keys(bloomQueueDocument.parameters).some(key=>key.startsWith("queue_")),
  "Bloom Queue JSON contains no hidden Row layout parameters");
const bloomQueueFromPanel=fromMotionDocument(documentFromValues(documentValues(toMotionDocument(bloomQueue))));
assert.deepEqual(bloomQueueFromPanel.geometry,bloomQueue.geometry,"Bloom geometry survives the editor store");
assert.deepEqual(bloomQueueFromPanel.appearance,bloomQueue.appearance,"Bloom styling survives the editor store");
assert.equal(animationFor(bloomQueueFromPanel),"queue","Bloom Queue survives the editor store");
assert.notDeepEqual(generateNodeKeyframes(bloomQueue,0,6),generateNodeKeyframes(applyAnimation(bloomQueue,"continuous"),0,6),
  "Bloom Queue changes step timing on the original trajectory");
const bloomQueueFrames=generateNodeKeyframes(bloomQueue,0,6);
const linear={type:"easing" as const,duration:1,ease:[0,0,1,1] as [number,number,number,number]};
const lateA=sampleGeneratedKeyframes(bloomQueueFrames,bloomQueue.motion.duration*.8/6,linear);
const lateB=sampleGeneratedKeyframes(bloomQueueFrames,bloomQueue.motion.duration*.95/6,linear);
assert(Math.hypot(lateA.x-lateB.x,lateA.y-lateB.y)>1e-4,
  "Queue continues moving through the whole slot by default");
const pausedQueue={...bloomQueue,motion:{...bloomQueue.motion,queueStep:.68}};
const pausedFrames=generateNodeKeyframes(pausedQueue,0,6);
const holdA=sampleGeneratedKeyframes(pausedFrames,pausedQueue.motion.duration*.8/6,linear);
const holdB=sampleGeneratedKeyframes(pausedFrames,pausedQueue.motion.duration*.95/6,linear);
assert(Math.hypot(holdA.x-holdB.x,holdA.y-holdB.y)<1e-6,
  "An explicitly shorter Queue transition keeps the requested pause");
assert.equal(validateMotionDocument({...bloomQueueDocument,parameters:{...bloomQueueDocument.parameters,
  queueStep:68,queueEasing:undefined as never}}).parameters.queueStep,100,
"Older default Queue timing migrates to a full transition");
const oldPanelValues=documentValues(bloomQueueDocument);
oldPanelValues["parameters.queueStep"]=68;
delete oldPanelValues["parameters.queueEasing"];
assert.equal(documentFromValues(oldPanelValues).parameters.queueStep,100,
  "The saved editor store also migrates the former Queue default");
for(const option of animationOptions){
  const base=freshPreset("circle");
  const selected=applyAnimation(base,option.value);
  assert.deepEqual(selected.geometry,base.geometry,"Animation selection preserves the chosen shape and dimensions");
  assert.equal(selected.motion.duration,base.motion.duration,"Selecting an animation preserves cycle duration");
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
const rowContinuous=applyAnimation(rowSettings,"continuous");
const rowContinuousScene=referenceScene(rowContinuous,sources,720,400,rowSettings.motion.duration*.23);
for(const option of animationOptions.filter(option=>!["queue","continuous"].includes(option.value))){
  const selected=applyAnimation(rowSettings,option.value);
  const restored=fromMotionDocument(validateMotionDocument(toMotionDocument(selected)));
  assert.notDeepEqual(referenceScene(restored,sources,720,400,rowSettings.motion.duration*.23),rowContinuousScene,
    "Row "+option.label+" visibly changes motion without replacing its layout");
}
for(const animation of ["continuous","fade"]){
  const switched=fromMotionDocument(validateMotionDocument(toMotionDocument(applyAnimation(rowSettings,animation))));
  const differentSizes=Array.from({length:9},(_,index)=>({width:120+index*35,height:160+index*12}));
  assert.equal(toMotionDocument(switched).model,"rfCarousel","Row keeps its layout renderer");
  const cards=referenceScene({...switched,reference:{...switched.reference,scaleCenter:"off"}},differentSizes,720,400,.6)
    .sort((a,b)=>a.x-b.x);
  const minimumGap=cardGapPx(switched,720,400);
  for(let i=1;i<cards.length;i++){
    const edgeGap=cards[i].x-cards[i-1].x-(cards[i].width+cards[i-1].width)/2;
    assert(edgeGap>=minimumGap-1e-6,
      "Switching Row to "+animation+" keeps its existing card gap with mixed source sizes");
  }
}
const rowContinuousEditor=motionEditor(toMotionDocument(applyAnimation(rowSettings,"continuous")));
assert(rowContinuousEditor.sections.some(section=>section.bindings.some(binding=>binding.id==="cardSize")),
  "Row sizing remains editable after choosing Continuous");
assert(rowContinuousEditor.sections.some(section=>section.bindings.some(binding=>binding.id==="shape_adaptiveSize")),
  "Row exposes adaptive card sizing beside Card Size");
const rowCardControls=rowContinuousEditor.sections.flatMap(section=>section.bindings.map(binding=>binding.id));
assert.equal(rowCardControls.indexOf("shape_adaptiveSize")+1,rowCardControls.indexOf("cardSize"),
  "Row places adaptive sizing above Card Size");
const orbitQueueEditor=motionEditor(toMotionDocument(applyAnimation(freshPreset("orbit-3d-tilted"),"queue")));
assert(orbitQueueEditor.sections.some(section=>section.bindings.some(binding=>binding.id==="cardSize")),
  "Queue exposes the existing orbit card size");
assert(orbitQueueEditor.sections.some(section=>section.bindings.some(binding=>binding.id==="adaptiveSize")),
  "Trajectory exposes adaptive card sizing beside Card Size");
const orbitCardControls=orbitQueueEditor.sections.flatMap(section=>section.bindings.map(binding=>binding.id));
assert.equal(orbitCardControls.indexOf("adaptiveSize")+1,orbitCardControls.indexOf("cardSize"),
  "Trajectory places adaptive sizing above Card Size");
const stackSettings=freshPreset("reference-stack-01");
const stackDocument=toMotionDocument(stackSettings);
const stackEditor=motionEditor(stackDocument);
const stackSizeControls=stackEditor.sections.flatMap(section=>section.bindings);
assert.equal(stackDocument.parameters.queueAnimation,true,"Stack starts with the shared Queue motion setting");
assert.equal(stackDocument.parameters.shape,"line","Stack starts with the line shape setting");
assert.equal(stackDocument.parameters.angle,90,"Stack starts with a vertical line");
assert(stackSizeControls.some(binding=>binding.id==="adaptiveSize"),
  "Stack exposes adaptive sizing next to Card Size");
assert.equal(stackSizeControls.findIndex(binding=>binding.id==="adaptiveSize")+1,
  stackSizeControls.findIndex(binding=>binding.id==="cardSize"),
  "Stack keeps the toggle immediately above Card Size");
const wideStackCard={width:400,height:100};
const stackWithAdaptation=referenceScene(stackSettings,[wideStackCard,wideStackCard],720,400,.5);
const stackWithoutAdaptation=referenceScene({...stackSettings,appearance:{...stackSettings.appearance,adaptiveSize:false}},
  [wideStackCard,wideStackCard],720,400,.5);
assert(stackWithAdaptation.length>0&&stackWithoutAdaptation.length>0);
assert(Math.max(...stackWithAdaptation.map(card=>card.width))<Math.max(...stackWithoutAdaptation.map(card=>card.width)),
  "Stack exports smaller wide cards when adaptive sizing is enabled");
const oldStackDocument={...stackDocument,parameters:{...stackDocument.parameters}};
for(const key of ["adaptiveSize","queueAnimation","shape","angle","exitFade"])
  delete oldStackDocument.parameters[key];
const migratedStack=validateMotionDocument(oldStackDocument);
assert.equal(migratedStack.parameters.adaptiveSize,true,
  "Previously saved Stack documents enable adaptive sizing by default");
assert.equal(migratedStack.parameters.queueAnimation,true,"Old Stack documents retain Queue timing");
assert.equal(migratedStack.parameters.shape,"line","Old Stack documents retain the vertical line");
assert.equal(migratedStack.parameters.angle,90,"Old Stack documents retain the vertical angle");
assert.equal(migratedStack.parameters.exitFade,0,"Old Stack documents retain instant exit");
const legacyStack=settingsFromSaved({preset:"reference-stack-01","motion.queue":false,
  "geometry.shape":"parametric","geometry.circleRotation":0},stackSettings);
assert.equal(legacyStack.motion.queue,true,"Legacy Stack values regain Queue timing");
assert.equal(legacyStack.geometry.shape,"line","Legacy Stack values regain the vertical line");
assert.equal(legacyStack.geometry.circleRotation,90,"Legacy Stack values regain the vertical angle");
for(const [key,value] of [["queueAnimation",false],["shape","ellipse"],["exitFade",100]] as const){
  const edited=fromMotionDocument({...stackDocument,parameters:{...stackDocument.parameters,[key]:value}});
  const flags=Array.from({length:6},()=>({width:120,height:160}));
  const times=[.1,.5,1.1,2.3,4.7];
  assert(times.some(time=>JSON.stringify(referenceScene(edited,flags,720,400,time))!==
    JSON.stringify(referenceScene(stackSettings,flags,720,400,time))),
    `Stack ${key} affects the exported animation`);
}
for(const base of [rowSettings,freshPreset("circle")]){
  const wide={width:400,height:100},tall={width:100,height:400},ordinary={width:120,height:160};
  const fixed={...base,appearance:{...base.appearance,adaptiveSize:false}};
  assert.equal(base.appearance.adaptiveSize,true,"Adaptive card sizing is on by default");
  assert.deepEqual(cardBaseSize(base,720,400,ordinary.width,ordinary.height),
    cardBaseSize(fixed,720,400,ordinary.width,ordinary.height),"Ordinary cards keep preset sizing");
  for(const size of [wide,tall]){
    const adaptive=cardBaseSize(base,720,400,size.width,size.height);
    const original=cardBaseSize(fixed,720,400,size.width,size.height);
    assert(Math.max(adaptive.width,adaptive.height)<Math.max(original.width,original.height),
      "Adaptive sizing reduces unusually wide or tall cards");
    assert(Math.abs(adaptive.width/adaptive.height-size.width/size.height)<1e-9,
      "Adaptive sizing preserves the source aspect ratio");
  }
  const restored=fromMotionDocument(validateMotionDocument(toMotionDocument(fixed)));
  assert.equal(restored.appearance.adaptiveSize,false,"The adaptive toggle survives JSON storage");
}
assert.equal(toMotionDocument(applyAnimation(freshPreset("orbit-3d-tilted"),"queue")).model,"trajectory",
  "Queue does not replace an orbit with Row's renderer");
for(const base of [rowSettings,freshPreset("circle"),freshPreset("orbit-3d-tilted"),freshPreset("bloom")]){
  for(const option of animationOptions){
    const switched=applyAnimation(base,option.value);
    assert.deepEqual(switched.geometry,base.geometry,"Animation keeps Shape for "+base.preset+" → "+option.value);
    assert.deepEqual(switched.appearance,base.appearance,"Animation keeps card presentation for "+base.preset+" → "+option.value);
    const restored=fromMotionDocument(validateMotionDocument(toMotionDocument(switched)));
    for(const source of [{width:120,height:160},{width:400,height:120},{width:80,height:240}]){
      const expected=cardBaseSize(base,720,400,source.width,source.height);
      assert.deepEqual(cardBaseSize(restored,720,400,source.width,source.height),expected,
        "Rendered base size survives animation and storage for "+base.preset+" → "+option.value);
    }
  }
}
for(const base of [rowSettings]){
  const queued=applyAnimation(base,"queue");
  const unstyled={...queued,geometry:{...queued.geometry,shape:"line" as const},
    appearance:{...queued.appearance,nearScale:1,farScale:1},
    reference:{...queued.reference,scaleCenter:"off",depthFade:0}};
  const continuous=applyAnimation(unstyled,"continuous");
  for(const source of [{width:120,height:160},{width:400,height:120},{width:80,height:240}]){
    const row=referenceScene(unstyled,[source],720,400,.1);
    const fitted=fitSettingsToFrame(continuous,720,400,source.width,source.height,1);
    assert(row.length>0);
    assert(Math.abs(row[0].width-source.width*fitted.appearance.nearScale)<1e-6,
      "Queue and Continuous render the same base card width across source sizes");
  }
}
const rowDocument=toMotionDocument(rowSettings);
const circleQueue=fromMotionDocument({...rowDocument,parameters:{...rowDocument.parameters,shape:"ellipse"}});
for(const time of [0,.17,1.13,2.6,4.8]){
  const line=referenceScene(rowSettings,sources,720,400,time);
  const curved=referenceScene(circleQueue,sources,720,400,time);
  assert.equal(new Set(curved.map(card=>card.source)).size,curved.length,"Closed Queue contains no repeated source cards");
  assert(curved.length>0);
  if(time===0)assert(curved.some(card=>Math.hypot(card.x-360,card.y-200)<1e-6),
    "Queue places its focused card in the frame center");
}
// Closed Queue advances by exactly one source slot, then holds the same
// pause as Row, regardless of gap and focus scaling.
for(const gap of [0,15])for(const scaleCenter of ["off","on"]){
  const stepped={...circleQueue,geometry:{...circleQueue.geometry,dynamicScale:false},reference:{...circleQueue.reference,duration:.4,delay:.8,stagger:0,cycles:1,gap,scaleCenter}};
  const logicalDuration=(.4+.8)*sources.length;
  const at=(time:number)=>referenceScene(stepped,sources,720,400,time/logicalDuration*stepped.motion.duration);
  const before=at(0),after=at(.5),paused=at(.9);
  const angle=(card:typeof before[number])=>Math.atan2((card.y-200)/(stepped.geometry.radiusY*400/100)+(scaleCenter==="on"?1:0),
    (card.x-360)/(stepped.geometry.radiusX*720/100));
  let compared=0;
  for(const card of before){
    const next=after.find(next=>next.source===card.source),hold=paused.find(next=>next.source===card.source);
    if(!next||!hold)continue;
    const delta=((angle(next)-angle(card))%(2*Math.PI)+2*Math.PI)%(2*Math.PI);
    assert(Math.abs(delta-2*Math.PI/sources.length)<1e-6,"Queue moves exactly one card slot per step: "+delta+" expected "+2*Math.PI/sources.length);
    assert(Math.hypot(next.x-hold.x,next.y-hold.y)<1e-6,"Queue holds position during the Row pause");
    compared++;
  }
  assert(compared>0,"Queue step test must compare visible sources");
}
const compact=freshPreset("orbit-3d-compact");
const fittedQueue={...rowSettings,geometry:{...compact.geometry},appearance:{...compact.appearance}};
fittedQueue.geometry.radiusX=60;fittedQueue.geometry.radiusY=32;
fittedQueue.reference={...fittedQueue.reference,planeSize:67.6,gap:7.4,visible:6,
  centerScale:1.6,scaleCenter:"on",scaleFocus:"center",depthFade:25};
const unfitQueue={...fittedQueue,geometry:{...fittedQueue.geometry,dynamicScale:false}};
const flags=Array.from({length:8},()=>({width:120,height:90}));
const fitRatios:number[]=[];
for(let step=0;step<24;step++){
  const time=step/24*fittedQueue.motion.duration;
  const fitted=referenceScene(fittedQueue,flags,576,264,time);
  const unfit=referenceScene(unfitQueue,flags,576,264,time);
  assert.equal(fitted.length,unfit.length);
  for(let i=0;i<fitted.length;i++){
    const card=fitted[i],original=unfit[i];
    assert(card.x-card.width/2>=-1e-6&&card.x+card.width/2<=576+1e-6&&
      card.y-card.height/2>=-1e-6&&card.y+card.height/2<=264+1e-6,
      "Queue Fit keeps the entire card inside the frame throughout the cycle");
    if(Math.abs(original.x-288)>1)fitRatios.push((card.x-288)/(original.x-288));
  }
}
assert(Math.min(...fitRatios)<.9,"The user Queue setup needs path fitting");
assert(Math.max(...fitRatios)-Math.min(...fitRatios)<1e-8,"Queue Fit stays constant during steps and pauses");
const helix=freshPreset("orbit-3d-helix");
const orbit02Queue={...rowSettings,geometry:{...helix.geometry},appearance:{...helix.appearance}};
for(const time of [0,2.25,4.5,9,13.5]){
  const cards=referenceScene(orbit02Queue,flags,576,264,time*orbit02Queue.motion.duration/18);
  const largest=cards.reduce((front,card)=>card.width>front.width?card:front);
  assert(Math.hypot(largest.x-288,largest.y-132)<1e-6,
    "Orbit 02 Queue keeps the largest card at the frame center");
}
for(const family of families)for(const variant of family.variants){
  const original=freshPreset(variant.id),queued=applyAnimation(original,"queue");
  assert.equal(referenceDefinition(queued),undefined,variant.id+": Queue keeps the trajectory renderer");
  assert.deepEqual(queued.geometry,original.geometry,variant.id+": Queue keeps geometry");
  assert.deepEqual(queued.appearance,original.appearance,variant.id+": Queue keeps appearance");
  const fitted=fitSettingsToFrame(queued,576,264,120,90,flags.length);
  const frames=generateNodeKeyframes(fitted,0,flags.length);
  assert(frames.every(frame=>[frame.x,frame.y,frame.z,frame.scaleX,frame.opacity].every(Number.isFinite)),
    variant.id+": Queue evaluates the current shape");
}
const queueRoundTrip=fromMotionDocument(validateMotionDocument(toMotionDocument(circleQueue)));
assert.deepEqual(referenceScene(queueRoundTrip,sources,720,400,1.13),referenceScene(circleQueue,sources,720,400,1.13));
const oldRowDocument={...rowDocument,parameters:{...rowDocument.parameters}};
for(const key of Object.keys(oldRowDocument.parameters))
  if(key==="shape"||key==="queueAnimation"||key.startsWith("queue_")||key.startsWith("shape_"))delete oldRowDocument.parameters[key];
const migratedRow=validateMotionDocument(oldRowDocument);
assert.equal(migratedRow.parameters.shape,"line","Saved Row keeps original linear path");
assert.equal(migratedRow.parameters.queueAnimation,true,"Saved Row retains stepped animation");
assert.equal(migratedRow.parameters.shape_frontScale,100,"Saved Row gains neutral trajectory styling");
assert.equal(migratedRow.parameters.shape_sizeBasis,"row","Saved Row retains its card sizing rule");
for(const queued of [rowSettings,applyAnimation(freshPreset("orbit-3d-tilted"),"queue")]){
  const continuous=applyAnimation(queued,"continuous");
  assert.deepEqual(continuous.geometry,queued.geometry,"Changing animation preserves Shape settings");
  assert.deepEqual(continuous.appearance,queued.appearance,"Changing animation preserves card styling");
  assert.equal(animationFor(continuous),"continuous");
  const restored=fromMotionDocument(validateMotionDocument(toMotionDocument(continuous)));
  assert.deepEqual(restored.geometry,continuous.geometry,"Persisted Shape survives animation switch");
  assert.deepEqual(restored.appearance,continuous.appearance,"Persisted styling survives animation switch");
  if(queued.geometry.shape!=="line")continue;
  const linear={...restored,reference:{...restored.reference,scaleCenter:"off"}};
  const at=(time:number)=>referenceScene(linear,[{width:120,height:90},{width:120,height:90},{width:120,height:90}],720,400,time)
    .find(card=>card.source===0&&Math.abs(card.x-360)<250)!;
  const first=at(.2),second=at(.4),third=at(.6);
  assert(first&&second&&third&&Math.abs((second.x-first.x)-(third.x-second.x))<1e-6,
    "Continuous after Row moves at constant speed in the same layout");
}
const curvedQueue=applyAnimation(freshPreset("circle"),"queue");
assert.equal(applyAnimation(curvedQueue,"continuous").geometry.shape,"ellipse",
  "Changing animation retains a curved Shape");
assert.equal(applyAnimation(rowSettings,"pulse").geometry.shape,"line");
const customRow={...rowSettings,reference:{...rowSettings.reference,gap:14,delay:.75,visible:4}};
const continuousRow=applyAnimation(customRow,"continuous");
const persistedRow=fromMotionDocument(validateMotionDocument(toMotionDocument(continuousRow)));
const queuedAgain=applyAnimation(persistedRow,"queue");
assert.equal(queuedAgain.geometry.shape,"line");
assert.equal(queuedAgain.reference?.gap,14,"Queue spacing survives animation and JSON switches");
assert.equal(queuedAgain.reference?.delay,.75,"Queue pause survives animation and JSON switches");
assert.equal(queuedAgain.reference?.visible,4,"Queue population survives animation and JSON switches");
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
for(const key of ["radiusPulse","scalePulse","opacityPulse","depthPulse","pathScale","sizeBasis","queue","queueStep"])delete oldCircle.parameters[key];
assert.equal(validateMotionDocument(oldCircle).parameters.radiusPulse,0,"Old documents gain neutral modifiers");
assert.equal(validateMotionDocument(oldCircle).parameters.sizeBasis,"standard","Old trajectories retain standard card sizing");
assert.equal(validateMotionDocument(oldCircle).parameters.queue,false,"Old trajectories retain continuous timing");
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
      assert.deepEqual(trace(renamed),b,id+": preset identity cannot alter trajectory output");
    }
  }
}
for(const id of [...presetOptions.map(p=>p.value),...referencePresets.map(p=>p.id)]){
  const source=freshPreset(id);
  for(const option of motionModelOptions){
    const switched=switchMotionModel(source,option.value);
    let document;
    try{document=validateMotionDocument(toMotionDocument(switched));}
    catch(error){throw new Error(id+" → "+option.value+": "+String(error));}
    assert.equal(document.model,option.value,id+" → "+option.value+": model is editable");
    assert.deepEqual(switched.geometry,source.geometry,id+" → "+option.value+": shape is preserved");
    assert.deepEqual(switched.appearance,source.appearance,id+" → "+option.value+": cards are preserved");
    assert.deepEqual(switched.motion,source.motion,id+" → "+option.value+": motion is preserved");
    assert.deepEqual(switched.other,source.other,id+" → "+option.value+": output settings are preserved");
    assert.equal(fromMotionDocument(document).renderer,switched.renderer,
      id+" → "+option.value+": model survives reload");
  }
}
for(const id of referencePresets.filter(preset=>preset.mode==="rfStack").map(preset=>preset.id)){
  const base=freshPreset(id),sizes=Array.from({length:6},()=>({width:120,height:160}));
  for(const visible of [1,2,3,6,8,12,20]){
    const settings={...base,reference:{...base.reference,visible}};
    const scenes=[0,.25,.5,1,2,3].map(time=>referenceScene(settings,sizes,720,400,time));
    assert(scenes.every(scene=>scene.length<=visible),id+": Visible cards must not exceed "+visible);
    assert(scenes.some(scene=>scene.length===visible),id+": Visible cards must reach "+visible);
  }
  for(let step=0;step<300;step++)assert.equal(referenceScene({...base,
    reference:{...base.reference,visible:1}},sizes,720,400,step/300*base.motion.duration).length,1,
    id+": one visible Stack card stays present throughout playback");
}
assert.equal(editableVisibleMax(20),12);
assert.equal(editableVisibleMax(6),20);
const manySources=Array.from({length:20},()=>({width:120,height:160}));
for(const id of ["reference-stack-01","reference-carousel-05"] as const){
  const base=freshPreset(id),limit=editableVisibleMax(manySources.length);
  const adjusted={...base,reference:{...base.reference,visible:limit}};
  assert(compileReference(adjusted,manySources,720,400).length<=256,
    id+": the full Visible cards range compiles to editable tracks");
}
const curvedRow=freshPreset("reference-carousel-05");
curvedRow.geometry.shape="ellipse";
curvedRow.reference={...curvedRow.reference,visible:editableVisibleMax(manySources.length)};
assert(compileReference(curvedRow,manySources,720,400).length<=256,
  "Curved Row Visible cards stays within the native export limit");
const rowWithManyCards=freshPreset("reference-carousel-05");
rowWithManyCards.reference={...rowWithManyCards.reference,visible:20};
const switchedStack=switchMotionModel(rowWithManyCards,"rfStack",20);
assert.equal(switchedStack.reference?.visible,12,"Changing layout respects the selected card count");
const stackFromBloom=toMotionDocument(switchMotionModel(freshPreset("bloom"),"rfStack",6));
const stackTarget=toMotionDocument(freshPreset("reference-stack-04"));
const stackControls=new Set(motionEditor(stackFromBloom).sections.flatMap(section=>
  section.bindings.map(binding=>binding.id)));
for(const [id,value] of Object.entries(stackTarget.parameters))
  if(JSON.stringify(stackFromBloom.parameters[id])!==JSON.stringify(value))
    assert(stackControls.has(id)||id==="queueAnimation","Stack parameter "+id+" can be edited after switching from Bloom");
const assembledStack=fromMotionDocument({...stackFromBloom,
  parameters:{...stackFromBloom.parameters,...stackTarget.parameters}});
for(const seconds of [0,.5,1.7,3.2])assert.deepEqual(
  referenceScene(assembledStack,sources,720,400,seconds),
  referenceScene(freshPreset("reference-stack-04"),sources,720,400,seconds),
  "Stack can be assembled from Bloom using the exposed parameters");
for(const id of [...presetOptions.map(p=>p.value),...referencePresets.map(p=>p.id)]){
  const target=freshPreset(id),targetDocument=toMotionDocument(target);
  const started=toMotionDocument(switchMotionModel(freshPreset("circle"),targetDocument.model,6));
  const assembled=fromMotionDocument({...started,
    parameters:{...started.parameters,...targetDocument.parameters},other:targetDocument.other});
  if(targetDocument.model==="trajectory"){
    const trace=(settings:typeof target)=>generateNodeKeyframes(
      fitSettingsToFrame(settings,720,400,120,160,6),0,6);
    assert.deepEqual(trace(assembled),trace(target),id+": settings recreate the trajectory from Circle");
  }else for(const seconds of [0,.27,1.13,2.47])
    assert.deepEqual(referenceScene(assembled,sources,720,400,seconds),
      referenceScene(target,sources,720,400,seconds),
      id+": settings recreate the native preset from Circle");
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

const orbit04=toMotionDocument(freshPreset("orbit-3d-compact"));
assert.equal(orbit04.parameters.offsetX,0,"Orbit 04 has a neutral explicit horizontal offset");
assert.equal(orbit04.parameters.offsetY,0,"Orbit 04 has a neutral explicit vertical offset");
const offsetEditor=motionEditor(orbit04);
for(const id of ["offsetX","offsetY"])
  assert(offsetEditor.sections.some(section=>section.bindings.some(binding=>binding.id===id)),
    `Orbit 04 exposes ${id} in the editor`);
const shiftedOrbit={...orbit04,parameters:{...orbit04.parameters,offsetX:15,offsetY:-12}};
assert.deepEqual(toMotionDocument(fromMotionDocument(validateMotionDocument(shiftedOrbit))),shiftedOrbit,
  "Position offsets survive JSON round trip");
const oldOffsetOrbit={...orbit04,parameters:{...orbit04.parameters}};
delete oldOffsetOrbit.parameters.offsetX;
delete oldOffsetOrbit.parameters.offsetY;
assert.equal(validateMotionDocument(oldOffsetOrbit).parameters.offsetX,0,"Old trajectory JSON gains a neutral X offset");
assert.equal(validateMotionDocument(oldOffsetOrbit).parameters.offsetY,0,"Old trajectory JSON gains a neutral Y offset");
for(const [key,value] of Object.entries({cycleDuration:6,stagger:0,radiusPulse:0,scalePulse:0,opacityPulse:0,depthPulse:0,
  shape:"parametric",fit:true,radiusX:60,radiusY:12.5,pathScale:100,angle:-15,depth:24.21875,tilt:15,
  turns:1,rotation:0,orient3d:true,cardSize:0,frontScale:124,backScale:52,backOpacity:25,yAmplitude:.65}))
  assert.equal(orbit04.parameters[key],value,"Orbit 04 exact setting: "+key);
assert.deepEqual(orbit04.parameters.easing,{type:"easing",duration:1,ease:[.17,.96,.68,.62]});
assert.deepEqual(orbit04.other,{centerBeforeApply:true,serviceLayers:"2",scope:"selection"});
assert.deepEqual(toMotionDocument(fromMotionDocument(validateMotionDocument(orbit04))),orbit04,"Orbit 04 precision survives reload");
