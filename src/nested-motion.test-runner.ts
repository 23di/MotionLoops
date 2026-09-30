// @ts-nocheck
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prepareNestedMotion, applyNestedMotion, applyNestedMotionBatch, nestedShift, restoreNestedMotion,
  visibilityWindows, mergeVisibilityWindows, entryForInstance, collectManualTracks, captureNestedState, nestedMotionNotice, mainCardStarts, mainPoseTime, retimeNestedTrack, loopRewindTimes, mainCardOccurrences, periodicNestedTrack } from "./nested-motion";
import { trackContents, planPresetConversion } from "./preset-conversion";
import { freshPreset, motionFingerprint } from "./catalog";
import { toMotionDocument, fromMotionDocument, validateMotionDocument, documentFromValues, documentValues } from "./motion-system";
import { parseSettingsJson, serializeSettingsJson } from "./settings-json";

const copy=value=>JSON.parse(JSON.stringify(value));
const nodes=new Map();let nextId=0,undoState,undoCount=0,writeCount=0,failWrite=false;
const key=(time,value)=>({timelinePosition:time,value:{type:"FLOAT",value},easing:{type:"LINEAR"}});
const track=(start=.3,end=1.3)=>({baseValue:{type:"FLOAT",value:0},keyframes:[key(start,0),key(end,100)]});
function node(children=[]){
  const data=new Map();
  const n={id:String(++nextId),name:"Layer",type:children.length?"GROUP":"RECTANGLE",removed:false,
    children,manualKeyframeTracks:{},animationStyles:[],animations:{},timelines:[],
    getPluginData:key=>data.get(key)??"",setPluginData:(key,value)=>data.set(key,value),
    applyManualKeyframeTrack(field,input){
      writeCount++;
      if(failWrite){failWrite=false;throw new Error("write failed");}
      const binding={...copy(input),id:"manual:"+JSON.stringify(field)};
      if(field.type==="PROPERTY")this.manualKeyframeTracks[field.name]=binding;
      else{
        const group=this.manualKeyframeTracks[field.collection]??={};
        if(field.propertyId)(group[field.index]??={properties:{}}).properties[field.propertyId]=binding;
        else if(field.field)(group[field.index]??={})[field.field]=binding;
        else group[field.index]=binding;
      }
    },
    removeAnimationStyle(id){this.animationStyles=this.animationStyles.filter(style=>style.id!==id);},
  };nodes.set(n.id,n);return n;
}
globalThis.figma={getNodeByIdAsync:async id=>nodes.get(id),commitUndo(){undoState=[...nodes.values()].map(n=>[n,copy(n.manualKeyframeTracks),copy(n.animationStyles)]);},
  triggerUndo(){undoCount++;for(const [n,tracks,styles] of undoState){n.manualKeyframeTracks=tracks;n.animationStyles=styles;}}};
const a=node(),b=node(),group=node([a,node([b])]);
a.manualKeyframeTracks.TRANSLATION_X=track();
b.manualKeyframeTracks.OPACITY=track(.8,1.8);
b.manualKeyframeTracks.effects={0:{radius:track(.5,1.5),properties:{amount:track(.7,1.7)}}};
b.manualKeyframeTracks.fills={0:track(.4,1.4)};
const originalA=copy(a.manualKeyframeTracks),originalB=copy(b.manualKeyframeTracks);
let [snapshot]=await prepareNestedMotion([group],true);
assert.equal(snapshot.layers.length,2);
assert.equal(collectManualTracks(b.manualKeyframeTracks).length,4);
await applyNestedMotion(group.id,snapshot,nestedShift(snapshot,2,.25),true);
assert.equal(a.manualKeyframeTracks.TRANSLATION_X.keyframes[0].timelinePosition,2.55);
assert.equal(b.manualKeyframeTracks.OPACITY.keyframes[0].timelinePosition,3.05,"Retain relative child delays");
assert.equal(b.manualKeyframeTracks.effects[0].properties.amount.keyframes[0].timelinePosition,2.95);
for(let i=0;i<3;i++){
  [snapshot]=await prepareNestedMotion([group],true);
  await applyNestedMotion(group.id,snapshot,nestedShift(snapshot,2,-.5),true);
  assert.equal(a.manualKeyframeTracks.TRANSLATION_X.keyframes[0].timelinePosition,1.8,"Refresh must not accumulate timing");
}
assert.equal(nestedShift(snapshot,0,-5),-.3,"Clamp the whole group, not individual keys");
await applyNestedMotion(group.id,snapshot,nestedShift(snapshot,0,-5),true);
assert.equal(a.manualKeyframeTracks.TRANSLATION_X.keyframes[1].timelinePosition,1,"Preserve key spacing at timeline zero");
assert.equal(b.manualKeyframeTracks.OPACITY.keyframes[0].timelinePosition,.5);
await restoreNestedMotion(group);
assert.deepEqual(trackContents(a.manualKeyframeTracks.TRANSLATION_X),originalA.TRANSLATION_X);
assert.deepEqual(trackContents(b.manualKeyframeTracks.OPACITY),originalB.OPACITY);
assert.equal(a.getPluginData("orbit-entry-motion"),"");
// A user edit after Apply remains authored data and is not silently overwritten.
[snapshot]=await prepareNestedMotion([group],true);await applyNestedMotion(group.id,snapshot,2,true);
a.manualKeyframeTracks.TRANSLATION_X=track(4,5);
await restoreNestedMotion(group);
assert.deepEqual(trackContents(a.manualKeyframeTracks.TRANSLATION_X),track(4,5));
assert.deepEqual(trackContents(b.manualKeyframeTracks.OPACITY),originalB.OPACITY);
// Failed nested writes restore already-written tracks and marker state.
[snapshot]=await prepareNestedMotion([group],true);
const beforeFailure=copy(a.manualKeyframeTracks);
const write=b.applyManualKeyframeTrack;
b.applyManualKeyframeTrack=function(...args){this.applyManualKeyframeTrack=write;throw new Error("child write failed");};
await assert.rejects(applyNestedMotion(group.id,snapshot,1,true),/child write failed/);
assert.deepEqual(trackContents(a.manualKeyframeTracks.TRANSLATION_X),trackContents(beforeFailure.TRANSLATION_X));
assert.equal(a.getPluginData("orbit-entry-motion"),"");
await assert.rejects(prepareNestedMotion([group,b],true),/outer cards only/);

// Recovery must not mutate untouched sources, including read-only static descendants.
const untouched=node(),staticChild=node(),untouchedRoot=node([untouched,staticChild]);
untouched.manualKeyframeTracks.OPACITY=track();
const undoUntouched=await captureNestedState([untouchedRoot]);
untouched.applyManualKeyframeTrack=()=>{throw new Error("unchanged track rewritten");};
untouched.setPluginData=staticChild.setPluginData=()=>{throw new Error("unchanged marker rewritten");};
await undoUntouched();
const [untouchedSnapshot]=await prepareNestedMotion([untouchedRoot],true);
await applyNestedMotion(untouchedRoot.id,untouchedSnapshot,0,false);

// Simulate native handles becoming stale on every track mutation.
const staleChild=node(),staleRoot=node([staleChild]);
staleChild.manualKeyframeTracks.OPACITY=track();
staleChild.manualKeyframeTracks.TRANSLATION_X=track();
const getNode=figma.getNodeByIdAsync;
let generation=0;
figma.getNodeByIdAsync=async id=>{
  const current=await getNode(id);
  if(id!==staleChild.id)return current;
  const handleGeneration=generation;
  return new Proxy(current,{get(target,property){
    if(property==="applyManualKeyframeTrack"||property==="setPluginData")return (...args)=>{
      if(handleGeneration!==generation)throw new Error("stale native handle");
      const result=target[property](...args);generation++;return result;
    };
    return target[property];
  }});
};
const [staleSnapshot]=await prepareNestedMotion([staleRoot],true);
await applyNestedMotion(staleRoot.id,staleSnapshot,2,true);
assert.equal(staleChild.manualKeyframeTracks.OPACITY.keyframes[0].timelinePosition,2.3);
assert.equal(staleChild.manualKeyframeTracks.TRANSLATION_X.keyframes[0].timelinePosition,2.3);
await restoreNestedMotion(staleRoot);
assert.equal(staleChild.manualKeyframeTracks.OPACITY.keyframes[0].timelinePosition,.3);
figma.getNodeByIdAsync=getNode;

// A rollback failure must retain the original write error and continue other layers.
const rollbackA=node(),rollbackB=node(),rollbackRoot=node([rollbackA,rollbackB]);
rollbackA.manualKeyframeTracks.OPACITY=track();rollbackB.manualKeyframeTracks.OPACITY=track();
const [rollbackSnapshot]=await prepareNestedMotion([rollbackRoot],true);
const writeRollbackA=rollbackA.applyManualKeyframeTrack;
let rollbackAWrites=0;
rollbackA.applyManualKeyframeTrack=function(...args){
  if(++rollbackAWrites>1)throw new Error("recovery rejected");
  return writeRollbackA.apply(this,args);
};
rollbackB.applyManualKeyframeTrack=()=>{throw new Error("original write rejected");};
await assert.rejects(applyNestedMotion(rollbackRoot.id,rollbackSnapshot,2,true),error=>
  /original write rejected/.test(error.message)&&/recovery rejected/.test(error.message));

// Real Ellipse 2 readback: an internal field is exposed with an empty name.
// Public Motion rejects it, so preserve it through shift, refresh and rollback.
const ellipse=node(),ellipseRoot=node([ellipse]);ellipse.name="Ellipse 2";
const internalTrack={id:"KeyframeTrackId:5586:62337",baseValue:{type:"FLOAT",value:6.2831854820251465},
  keyframes:[key(.129717,3.1415927410125732),key(1.329717,5.989233016967773)]};
ellipse.manualKeyframeTracks[""]=copy(internalTrack);
ellipse.manualKeyframeTracks.OPACITY=track();
const ellipseWrite=ellipse.applyManualKeyframeTrack;
ellipse.applyManualKeyframeTrack=function(field,input){
  assert.notEqual(field.name,"","Never write a field rejected by the public API");
  return ellipseWrite.call(this,field,input);
};
const [ellipseSnapshot]=await prepareNestedMotion([ellipseRoot],true);
assert.match(nestedMotionNotice([ellipseSnapshot]),/Ellipse 2.*unnamed field/);
assert.equal(ellipseSnapshot.layers[0].tracks.length,1);
const restoreEllipse=await captureNestedState([ellipseRoot]);
await applyNestedMotion(ellipseRoot.id,ellipseSnapshot,2,true);
assert.equal(ellipse.manualKeyframeTracks.OPACITY.keyframes[0].timelinePosition,2.3);
assert.deepEqual(ellipse.manualKeyframeTracks[""],internalTrack);
await restoreEllipse();await restoreNestedMotion(ellipseRoot);
assert.deepEqual(ellipse.manualKeyframeTracks[""],internalTrack);
assert.equal(ellipse.manualKeyframeTracks.OPACITY.keyframes[0].timelinePosition,.3);
assert.equal(nestedMotionNotice(await prepareNestedMotion([ellipseRoot],false)),"");

// A preset offset is baked once, then the card-entry offset is added.
const styled=node();const preset={id:"fade",duration:1,timelineOffset:.75};
styled.animationStyles=[preset];
styled.animations={OPACITY:{baseValue:{type:"FLOAT",value:1},tracks:[{id:"resolved",animationPreset:{id:"fade"},keyframeOperation:"SET",keyframes:[key(0,0),key(1,1)]}]}};
const styledWithInternal=node();
Object.assign(styledWithInternal,{animationStyles:copy(styled.animationStyles),
  manualKeyframeTracks:{"":copy(internalTrack)},animations:{...copy(styled.animations),
    "":{baseValue:internalTrack.baseValue,tracks:[{...copy(internalTrack),keyframeOperation:"SET"}]}}});
assert.equal(planPresetConversion(styledWithInternal,new Set(["OPACITY"])).tracks.length,1);
const styledGroup=node([styled]);
const [baked]=await prepareNestedMotion([styledGroup],true);
assert.equal(styled.animationStyles.length,0);
assert.equal(styled.manualKeyframeTracks.OPACITY.keyframes[0].timelinePosition,.75);
await applyNestedMotion(styledGroup.id,baked,nestedShift(baked,2,-.25),true);
assert.equal(styled.manualKeyframeTracks.OPACITY.keyframes[0].timelinePosition,2.5);
await restoreNestedMotion(styledGroup);
assert.equal(styled.manualKeyframeTracks.OPACITY.keyframes[0].timelinePosition,.75);
assert.equal(styled.animationStyles.length,0,"Clear retains baked keys");
const conflict=node();conflict.animationStyles=[preset];conflict.animations=copy(styled.animations);
conflict.manualKeyframeTracks.OPACITY={...track(),id:"authored"};
const beforeWrites=writeCount;
await assert.rejects(prepareNestedMotion([node([conflict])],true),/both manual keyframes and a preset/);
assert.equal(writeCount,beforeWrites,"Conversion preflights before any writes");
const failing=node();failing.animationStyles=[preset];failing.animations=copy(styled.animations);
const secondFail=node();secondFail.animationStyles=[preset];secondFail.animations=copy(styled.animations);
secondFail.applyManualKeyframeTrack=()=>{throw new Error("conversion failed");};
await assert.rejects(prepareNestedMotion([node([failing,secondFail])],true),/conversion failed/);
assert.equal(undoCount,1);assert.deepEqual(failing.manualKeyframeTracks,{});assert.equal(failing.animationStyles.length,1);

// Real Desktop readbacks from Motion Stagger: 59 presets / 74 tracks.
const fixtures=JSON.parse(readFileSync("src/fixtures/motion-conversion.json","utf8"));
const real=fixtures.map(fixture=>{const n=node();n.animationStyles=copy(fixture.styles);n.animations=copy(fixture.animations);return n;});
await prepareNestedMotion([node(real)],true);
assert.equal(real.reduce((sum,n)=>sum+Object.keys(n.manualKeyframeTracks).length,0),74);
real.forEach((n,i)=>{for(const [field,binding] of Object.entries(fixtures[i].animations)){
  const starts=binding.tracks.map(t=>fixtures[i].styles.find(s=>s.id===t.animationPreset.id).timelineOffset+t.keyframes[0].timelinePosition);
  assert.equal(n.manualKeyframeTracks[field].keyframes[0].timelinePosition,Math.min(...starts));
}});
const overlap=JSON.parse(readFileSync("src/fixtures/overlapping-presets.json","utf8"));
const overlapping=node();overlapping.animationStyles=copy(overlap.styles);overlapping.animations=copy(overlap.animations);
await prepareNestedMotion([node([overlapping])],true);
function sample(keys,time){
  if(time<=keys[0].timelinePosition)return keys[0].value.value;
  const end=keys.findIndex(key=>key.timelinePosition>=time);
  if(end<0)return keys.at(-1).value.value;
  const a=keys[end-1],b=keys[end],p=(time-a.timelinePosition)/(b.timelinePosition-a.timelinePosition);
  if(b.easing.type==="HOLD")return a.value.value;
  const curve=b.easing.easingFunctionCubicBezier;
  const cubic=(t,a,b)=>3*(1-t)**2*t*a+3*(1-t)*t*t*b+t**3;
  let q=p;
  if(curve&&b.easing.type!=="LINEAR"){
    let lo=0,hi=1;for(let i=0;i<50;i++){const mid=(lo+hi)/2;if(cubic(mid,curve.x1,curve.x2)<p)lo=mid;else hi=mid;}
    q=cubic((lo+hi)/2,curve.y1,curve.y2);
  }
  return a.value.value+(b.value.value-a.value.value)*q;
}
const sources=overlap.animations.TRANSLATION_X.tracks.map(track=>track.keyframes.map(key=>({...key,
  timelinePosition:key.timelinePosition+overlap.styles.find(s=>s.id===track.animationPreset.id).timelineOffset})));
for(let t=0;t<6;t+=.007){
  const expected=sources.reduce((sum,keys)=>sum+sample(keys,t),0);
  assert(Math.abs(sample(overlapping.manualKeyframeTracks.TRANSLATION_X.keyframes,t)-expected)<.001);
}

// Regression from the user's Group 25: a neutral 1→1 spring scale overlaps
// an eased 1.4→1 scale. Keep the active easing and the full preset interval.
const identityFixture=JSON.parse(readFileSync("src/fixtures/overlapping-identity-presets.json","utf8"));
const identityNode=node();identityNode.animationStyles=copy(identityFixture.styles);identityNode.animations=copy(identityFixture.animations);
const identityGroup=node([identityNode]);
const [identitySnapshot]=await prepareNestedMotion([identityGroup],true);
assert.equal(identityNode.animationStyles.length,0);
for(const field of ["SCALE_X","SCALE_Y"]){
  const keys=identityNode.manualKeyframeTracks[field].keyframes;
  assert.deepEqual(keys.map(key=>key.timelinePosition),[.1,.6,1.3]);
  const moving=identityFixture.animations[field].tracks[1].keyframes.map(key=>({...key,timelinePosition:key.timelinePosition+.1}));
  assert.deepEqual(keys[1].easing,moving[1].easing,"Retain the authored ease, without sampling");
  for(let t=0;t<1.5;t+=.003)assert(Math.abs(sample(keys,t)-sample(moving,t))<1e-10,"Identity scale must not alter playback");
}
await applyNestedMotion(identityGroup.id,identitySnapshot,nestedShift(identitySnapshot,2,-.25),true);
assert.equal(identityNode.manualKeyframeTracks.SCALE_X.keyframes[0].timelinePosition,1.85);
await restoreNestedMotion(identityGroup);
assert.deepEqual(identityNode.manualKeyframeTracks.SCALE_X.keyframes.map(key=>key.timelinePosition),[.1,.6,1.3]);
// Earlier identities keep their first time, and OFFSET=0 can be removed even
// alongside a different operation. A constant SET=1 still replaces values.
const identityVariant=(operation,values)=>{
  const n=node();n.animationStyles=copy(identityFixture.styles);n.animationStyles[0].timelineOffset=0;
  n.animations=copy(identityFixture.animations);
  for(const binding of Object.values(n.animations)){
    binding.tracks[0].keyframeOperation=operation;
    binding.tracks[0].keyframes.forEach((key,i)=>{key.value.value=values[i];});
  }
  return n;
};
for(const operation of ["SCALE","OFFSET"]){
  const n=identityVariant(operation,operation==="SCALE"?[1,1]:[0,0]);
  await prepareNestedMotion([node([n])],true);
  assert.deepEqual(n.manualKeyframeTracks.SCALE_X.keyframes.map(key=>key.timelinePosition),[0,.1,.6,1.2]);
  assert.equal(n.manualKeyframeTracks.SCALE_X.keyframes[0].value.value,1.399999976158142);
}
const setIsNotIdentity=identityVariant("SET",[1,1]);
const identityWrites=writeCount;
await assert.rejects(prepareNestedMotion([node([setIsNotIdentity])],true),/SCALE_X.*different preset track operations/);
assert.equal(writeCount,identityWrites,"Unsupported real overlap still fails before touching presets");
// All-identity bindings still produce an editable track with the original span.
const allIdentity=identityVariant("SCALE",[1,1]);
for(const binding of Object.values(allIdentity.animations))binding.tracks[1].keyframes.forEach(key=>{key.value.value=1;});
await prepareNestedMotion([node([allIdentity])],true);
assert(allIdentity.manualKeyframeTracks.SCALE_X.keyframes.every(key=>key.value.value===1));
assert.equal(allIdentity.manualKeyframeTracks.SCALE_X.keyframes[0].timelinePosition,0);
assert.equal(allIdentity.manualKeyframeTracks.SCALE_X.keyframes.at(-1).timelinePosition,1.2);

const frame=(time,x,opacity=1,rotation=0)=>({time,x,y:0,z:0,scaleX:1,scaleY:1,rotation,opacity});
const geometry={width:100,height:80,frameWidth:720,frameHeight:400};
const windows=visibilityWindows([frame(0,-600),frame(4,600)],geometry);
assert(Math.abs(windows[0].start-190/300)<1/120+.00001,"Start at the entering card edge, not its center");
assert.equal(visibilityWindows([frame(0,0),frame(4,0)],geometry)[0].start,0);
assert.deepEqual(visibilityWindows([frame(0,0,0),frame(4,0,0)],geometry),[]);
const merged=mergeVisibilityWindows([{start:.4,end:1},{start:1.0000001,end:2},{start:3,end:4}]);
assert.deepEqual(merged,[{start:.4,end:2},{start:3,end:4}]);
assert.equal(entryForInstance([{start:1.0000001,end:2}],merged,5),.4,"Depth handoffs retain original entry");
assert.equal(entryForInstance([],merged,5),5);
const settings=freshPreset("circle");settings.other.startOnEntry=true;settings.other.entryOffset=-.42;
assert.deepEqual(parseSettingsJson(serializeSettingsJson(settings),freshPreset("circle")).other,settings.other);
assert.deepEqual(fromMotionDocument(documentFromValues(documentValues(toMotionDocument(settings)))).other,settings.other);
const old=toMotionDocument(settings);delete old.other.startOnEntry;delete old.other.entryOffset;
assert.equal(validateMotionDocument(old).other.startOnEntry,false);assert.equal(validateMotionDocument(old).other.entryOffset,0);
const invalid=toMotionDocument(settings);invalid.other.entryOffset=NaN;
await assert.rejects(async()=>validateMotionDocument(invalid),/entry timing/);
assert.notEqual(motionFingerprint(settings),motionFingerprint({...settings,other:{...settings.other,entryOffset:.2}}));
console.log("Nested motion: preset offsets, real conversion playback, entry geometry, refresh, restore, rollback and settings passed");

// Both cards are already visible. Entry must wait for foreground ownership.
const mainFrame=(time,x,z=0)=>({time,x,y:0,z,scaleX:1,scaleY:1,rotation:0,opacity:1});
assert.deepEqual(mainCardStarts([
  {source:0,layer:2,frames:[mainFrame(0,0),{...mainFrame(1,0),opacity:0}, {...mainFrame(2,0),opacity:0}]},
  {source:1,layer:1,frames:[mainFrame(0,20),mainFrame(1,0),mainFrame(2,0)]},
],2,3,"front"),[0,1]);
assert.deepEqual(mainCardStarts([
  {source:0,layer:1,frames:[mainFrame(0,0),mainFrame(1,-100)]},
  {source:1,layer:0,frames:[mainFrame(0,100),mainFrame(1,0)]},
],2,2),[0,1]);
assert.equal(mainPoseTime([mainFrame(0,0,-1),mainFrame(1,10,1),mainFrame(2,0,0)],3),1);
assert.equal(mainPoseTime([mainFrame(0,-100),mainFrame(1,0),mainFrame(2,100)],3),1);

// A full native composition flushes once, after all cards have been written.
const batchChildren=Array.from({length:24},()=>node());
for(const child of batchChildren)child.manualKeyframeTracks.OPACITY=track();
const batchRoots=batchChildren.map(child=>node([node([child])]));
const batchSnapshots=await prepareNestedMotion(batchRoots,true);
const batchJobs=batchRoots.map((root,i)=>({rootId:root.id,snapshot:batchSnapshots[i],shift:2,enabled:true}));
const nativeTimeout=globalThis.setTimeout;let batchFlushes=0;
globalThis.setTimeout=(callback,delay,...args)=>{
  batchFlushes++;
  assert(batchChildren.every(child=>child.manualKeyframeTracks.OPACITY.keyframes[0].timelinePosition===2.3),"All cards must be written before flushing");
  return nativeTimeout(callback,delay,...args);
};
try{await applyNestedMotionBatch(batchJobs);assert.equal(batchFlushes,1);}finally{globalThis.setTimeout=nativeTimeout;}
// A failure on a later card rolls back the entire batch.
const batchBefore=batchChildren.map(child=>copy(child.manualKeyframeTracks));
const batchFail=batchChildren.at(-1),batchWrite=batchFail.applyManualKeyframeTrack;
batchFail.applyManualKeyframeTrack=function(...args){this.applyManualKeyframeTrack=batchWrite;throw new Error("batch write rejected");};
await assert.rejects(applyNestedMotionBatch(batchJobs.map(job=>({...job,shift:3}))),/batch write rejected/);
assert.deepEqual(batchChildren.map(child=>child.manualKeyframeTracks),batchBefore);
console.log("Nested batch: 24 cards, one flush, whole-batch rollback passed");

// A returning seam duplicate resets instantly, without a reverse tween.
const loopTrack=retimeNestedTrack(track(.2,.8),.4,4,5);
assert.deepEqual(loopTrack.keyframes.slice(0,-1),retimeNestedTrack(track(.2,.8),.4).keyframes);
assert.equal(loopTrack.keyframes.at(-1).timelinePosition,4);
assert.equal(loopTrack.keyframes.at(-1).easing.type,"HOLD");
assert.deepEqual(loopTrack.keyframes.at(-1).value,loopTrack.keyframes[0].value);
const cropped=retimeNestedTrack(track(0,6),0,5,5);
assert(Math.abs(cropped.keyframes.at(-2).value.value-100*(5-1e-5)/6)<1e-8,"Long animations keep interpolating right up to the seam");
assert.equal(cropped.keyframes.at(-1).value.value,0);
const vf=(time,opacity)=>({...mainFrame(time,0),opacity});
assert.deepEqual(loopRewindTimes([
 {source:0,frames:[vf(0,1),vf(1,0),vf(2,0),vf(3,0),vf(4,1)]},
 {source:0,frames:[vf(0,0),vf(1,1),vf(2,1),vf(3,0),vf(4,0)]},
 {source:1,frames:[vf(0,0),vf(1,1),vf(2,1),vf(3,1),vf(4,0)]},
],2,4,[0,1]),[4,undefined],"Layer handoff preserves playback; only returning seam cards rewind");
const loopChild=node(),loopRoot=node([loopChild]);loopChild.manualKeyframeTracks.OPACITY=track(.2,.8);
for(let i=0;i<2;i++){
 const [snapshot]=await prepareNestedMotion([loopRoot],true);
 await applyNestedMotionBatch([{rootId:loopRoot.id,snapshot,shift:.4,enabled:true,rewindAt:4,loopEnd:5}]);
 assert.deepEqual(trackContents(loopChild.manualKeyframeTracks.OPACITY),loopTrack,"Refresh never accumulates rewind keys");
}
await restoreNestedMotion(loopRoot);
assert.deepEqual(trackContents(loopChild.manualKeyframeTracks.OPACITY),track(.2,.8),"Clear removes the generated rewind");
console.log("Nested loop seam: discrete rewind, service handoffs, Refresh and Clear passed");

const curvedLoop=track(0,6);curvedLoop.keyframes[1].easing={type:"CUSTOM_CUBIC_BEZIER",easingFunctionCubicBezier:{x1:.3,y1:.1,x2:.65,y2:.9}};
const clippedLoop=retimeNestedTrack(curvedLoop,0,4,5);
for(let t=0;t<3.999;t+=.025)assert(Math.abs(sample(curvedLoop.keyframes,t)-sample(clippedLoop.keyframes,t))<1e-7,"Clipping preserves the visible cubic curve");

// The last duplicate becomes main before the seam and must replay immediately.
const repeat=periodicNestedTrack(track(.2,1.4),[{start:9,reset:8}],0,10);
for(const offset of [1e20,-1e20,Number.MAX_VALUE,-Number.MAX_VALUE]){
  const bounded=periodicNestedTrack(track(.2,1.4),[{start:9,reset:8}],offset,10);
  assert(bounded.keyframes.length>0&&bounded.keyframes.length<30,"Huge finite offsets generate bounded tracks");
  assert(bounded.keyframes.every(key=>Number.isFinite(key.timelinePosition)&&key.timelinePosition>=0&&key.timelinePosition<=10));
}
assert.throws(()=>periodicNestedTrack(track(),[{start:1,reset:0}],0,0),/Invalid nested loop timing/);
assert(Math.abs(sample(repeat.keyframes,9.8)-50)<1e-6,"Returning duplicate advances before the timeline wraps");
assert(Math.abs(sample(repeat.keyframes,0)-sample(repeat.keyframes,10))<1e-6,"Tail wraps continuously into the first frame");
assert(Math.abs(sample(repeat.keyframes,.1)-75)<1e-6,"Wrapped animation continues, without replaying the initial delay");
const repeatCurve=periodicNestedTrack(curvedLoop,[{start:9,reset:8}],0,10);
for(let t=0;t<.9;t+=.05)assert(Math.abs(sample(repeatCurve.keyframes,t)-sample(curvedLoop.keyframes,t+1))<1e-6,"Cubic suffix across zero keeps its original playback");
assert.deepEqual(mainCardOccurrences([
 {source:0,layer:2,frames:[vf(0,1),vf(1,0),vf(9,1),vf(10,1)]},
 {source:1,layer:1,frames:[vf(0,1),vf(1,1),vf(9,1),vf(10,1)]},
],2,10,"front").map(list=>list.map(event=>event.start)),[[9],[1]],"Do not add a fake second start at time zero");
console.log("Nested repeated foreground: no last-card pause, continuous linear/cubic seam passed");
