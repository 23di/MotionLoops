// @ts-nocheck
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { prepareNestedMotion, applyNestedMotion, applyNestedMotionBatch, nestedShift, restoreNestedMotion,
  visibilityWindows, mergeVisibilityWindows, entryForInstance, collectManualTracks, captureNestedState, nestedMotionNotice, mainCardStarts, mainPoseTime, retimeNestedTrack, loopRewindTimes, mainCardOccurrences, periodicNestedTrack } from "./nested-motion";
import { trackContents, planPresetConversion } from "./preset-conversion";
import { mainPoseOccurrences, normalizeWrappingPathTrim, fittedNestedLoop } from "./nested-motion";
import { fitSettingsToFrame, generateNodeKeyframes } from "./engine";
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

// Native writes may replace the card ID as well as all descendant IDs, without
// retaining old aliases. Refresh and rollback must resolve from the page tree.
const remapA=node(),remapB=node(),remapCard=node([remapA,remapB]);
remapA.manualKeyframeTracks.OPACITY=track();remapA.manualKeyframeTracks.TRANSLATION_X=track();
remapB.manualKeyframeTracks.OPACITY=track();
const remapPage={id:'remap-page',type:'PAGE',children:[remapCard],manualKeyframeTracks:{},animationStyles:[]};nodes.set(remapPage.id,remapPage);
remapCard.parent=remapPage;remapA.parent=remapB.parent=remapCard;
const [remapSnapshot]=await prepareNestedMotion([remapCard],true);
const restoreRemapped=await captureNestedState([remapCard]);
const remapWrite=remapA.applyManualKeyframeTrack;let remapGeneration=0;
remapA.applyManualKeyframeTrack=function(...args){
  remapWrite.apply(this,args);
  for(const n of [remapCard,remapA,remapB]){nodes.delete(n.id);n.id+='-new-'+(++remapGeneration);nodes.set(n.id,n);}
};
await applyNestedMotion(remapCard.id,remapSnapshot,2,true);
assert.equal(remapA.manualKeyframeTracks.TRANSLATION_X.keyframes[0].timelinePosition,2.3);
assert.equal(remapB.manualKeyframeTracks.OPACITY.keyframes[0].timelinePosition,2.3);
await restoreNestedMotion(remapCard);
assert.equal(remapB.manualKeyframeTracks.OPACITY.keyframes[0].timelinePosition,.3);
await applyNestedMotion(remapCard.id,remapSnapshot,2,true);
await restoreRemapped();
assert.equal(remapA.manualKeyframeTracks.OPACITY.keyframes[0].timelinePosition,.3);
const failRemapWrite=remapB.applyManualKeyframeTrack;let rejectRemap=true;
remapB.applyManualKeyframeTrack=function(...args){if(rejectRemap){rejectRemap=false;throw new Error('remapped write failed');}return failRemapWrite.apply(this,args);};
await assert.rejects(applyNestedMotion(remapCard.id,remapSnapshot,2,true),error=>
  /remapped write failed/.test(error.message)&&!/rollback failed/.test(error.message));
assert.equal(remapA.manualKeyframeTracks.OPACITY.keyframes[0].timelinePosition,.3);
assert.equal(remapA.getPluginData('orbit-entry-motion'),'');
console.log('Nested replaced IDs: Apply, toggle off/on, source recovery and rollback passed');

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
  if(time===keys[end].timelinePosition)return keys[end].value.value;
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

// Orbit 01 cards remain visible in the rear: the timeline seam is not a reset.
const revealTrack=track(0,1.2);
let reproducedSeam=false;
for(const turns of [1,2])for(let index=0;index<6;index++){
 const orbit=freshPreset("orbit-3d-tilted");orbit.geometry.turns=turns;
 const fitted=fitSettingsToFrame(orbit,1920,1280,400,460,6);
 const frames=generateNodeKeyframes({...fitted,motion:{...fitted.motion,keyframes:32}},index,6);
 const occurrences=mainPoseOccurrences(frames,orbit.motion.duration);
 assert.equal(occurrences.length,turns,"Replay every foreground visit, including multiple turns");
 const old=retimeNestedTrack(revealTrack,mainPoseTime(frames,orbit.motion.duration),orbit.motion.duration,orbit.motion.duration);
 if(Math.abs(sample(old.keyframes,orbit.motion.duration-1e-4)-sample(old.keyframes,0))>1)reproducedSeam=true;
 for(const offset of [-.2,0,.2]){
  const replay=periodicNestedTrack(revealTrack,occurrences,offset,orbit.motion.duration);
  assert(Math.abs(sample(replay.keyframes,0)-sample(replay.keyframes,orbit.motion.duration))<1e-6,"Orbit inner state is continuous across the loop seam");
  for(const occurrence of occurrences){
   const probe=(occurrence.start+offset+.6+orbit.motion.duration)%orbit.motion.duration;
   assert(Math.abs(sample(replay.keyframes,probe)-50)<1e-5,"Every foreground visit advances the 1.2 second reveal");
  }
 }
}
assert(reproducedSeam,"Real Orbit 01 geometry reproduces the previous loop reset");
assert.equal(freshPreset("orbit-3d-tilted").other.startOnEntry,true);
const explicitlyDisabled=freshPreset("circle");explicitlyDisabled.other.startOnEntry=false;
assert.equal(freshPreset("orbit-3d-tilted",explicitlyDisabled).other.startOnEntry,false,"Preserve an explicit opt-out when switching presets");
console.log("Orbit 01 nested replay: reproduced old seam, six cards, multiple turns and offsets passed");

// Desktop fills in LINEAR Bézier metadata when a rotating loop crosses the seam.
const nativeLinear=node(),nativeLinearRoot=node([nativeLinear]);
nativeLinear.manualKeyframeTracks.ROTATION={baseValue:{type:"FLOAT",value:0},keyframes:
 Array.from({length:25},(_,i)=>key(i*.05,-9*Math.cos(2*Math.PI*(i===24?0:i/24))))};
const nativeLinearOriginal=copy(nativeLinear.manualKeyframeTracks.ROTATION);
const nativeLinearWrite=nativeLinear.applyManualKeyframeTrack;
nativeLinear.applyManualKeyframeTrack=function(field,input){
 const canonical=copy(input);
 for(const k of canonical.keyframes)if(k.easing?.type==="LINEAR")k.easing.easingFunctionCubicBezier={x1:0,y1:0,x2:1,y2:1};
 nativeLinearWrite.call(this,field,canonical);
};
for(let pass=0;pass<2;pass++){
 const [snapshot]=await prepareNestedMotion([nativeLinearRoot],true);
 await applyNestedMotionBatch([{rootId:nativeLinearRoot.id,snapshot,shift:5.4375,enabled:true,occurrences:[{start:5.4375,reset:.75}],offset:0,loopEnd:6}]);
 const expected=periodicNestedTrack(nativeLinearOriginal,[{start:5.4375,reset:.75}],0,6);
 assert.deepEqual(trackContents(nativeLinear.manualKeyframeTracks.ROTATION),trackContents(expected),"Native LINEAR metadata preserves the actual motion");
}
await restoreNestedMotion(nativeLinearRoot);
assert.deepEqual(trackContents(nativeLinear.manualKeyframeTracks.ROTATION),trackContents(nativeLinearOriginal),"Clear restores authored rotation after native normalization");
console.log("Native FORM rotation: LINEAR readback normalization, Refresh and Clear passed");

// Explicit opt-in repeats the entire authored card timeline, including delays.
const loopingReveal=periodicNestedTrack(track(0,1.2),[{start:9,reset:8}],0,10,1.2);
assert(Math.abs(sample(loopingReveal.keyframes,9.6)-50)<1e-5);
assert(Math.abs(sample(loopingReveal.keyframes,.8)-50)<1e-5,"Second inner cycle continues across the outer seam");
assert(Math.abs(sample(loopingReveal.keyframes,0)-sample(loopingReveal.keyframes,10))<1e-6);
assert.equal(sample(periodicNestedTrack(track(0,1.2),[{start:9,reset:8}],0,10).keyframes,.8),100,"Default remains one-shot");
const short=node(),long=node(),repeatRoot=node([short,long]);
short.manualKeyframeTracks.OPACITY=track(.2,.8);long.manualKeyframeTracks.TRANSLATION_X=track(0,1.2);
const shortOriginal=copy(short.manualKeyframeTracks.OPACITY),longOriginal=copy(long.manualKeyframeTracks.TRANSLATION_X);
let firstRepeat;
for(let pass=0;pass<2;pass++){
 const [snapshot]=await prepareNestedMotion([repeatRoot],true);
 await applyNestedMotionBatch([{rootId:repeatRoot.id,snapshot,shift:0,enabled:true,repeat:true,loopEnd:6}]);
 const actual=trackContents(short.manualKeyframeTracks.OPACITY);
 if(firstRepeat)assert.deepEqual(actual,firstRepeat,"Refresh does not accumulate generated repeats");else firstRepeat=actual;
 for(const cycle of [0,1,2,3,4]){
  assert(Math.abs(sample(actual.keyframes,cycle*1.2+.5)-50)<1e-5,"Tracks share the card duration and preserve their initial delay");
  assert.equal(sample(actual.keyframes,cycle*1.2+1),100,"Shorter tracks hold until the shared restart");
 }
}
const [oneShotSnapshot]=await prepareNestedMotion([repeatRoot],true);
await applyNestedMotionBatch([{rootId:repeatRoot.id,snapshot:oneShotSnapshot,shift:0,enabled:true,repeat:false,loopEnd:6}]);
assert.deepEqual(trackContents(short.manualKeyframeTracks.OPACITY),shortOriginal,"Toggle off restores authored timing");
const [again]=await prepareNestedMotion([repeatRoot],true);
await applyNestedMotionBatch([{rootId:repeatRoot.id,snapshot:again,shift:0,enabled:true,repeat:true,loopEnd:6}]);
await restoreNestedMotion(repeatRoot);
assert.deepEqual(trackContents(short.manualKeyframeTracks.OPACITY),shortOriginal);
assert.deepEqual(trackContents(long.manualKeyframeTracks.TRANSLATION_X),longOriginal,"Clear restores original duration, not expanded keys");
assert.equal(freshPreset("circle").other.loopCardAnimation,false);
const loopSettings=freshPreset("circle");loopSettings.other.loopCardAnimation=true;
assert.equal(freshPreset("reference-stack-01",loopSettings).other.loopCardAnimation,true);
assert.deepEqual(parseSettingsJson(serializeSettingsJson(loopSettings),freshPreset("circle")).other,loopSettings.other);
assert.notEqual(motionFingerprint(loopSettings),motionFingerprint(freshPreset("circle")));
const oldLoop=toMotionDocument(loopSettings);delete oldLoop.other.loopCardAnimation;
assert.equal(validateMotionDocument(oldLoop).other.loopCardAnimation,false);
const invalidLoop=toMotionDocument(loopSettings);invalidLoop.other.loopCardAnimation="true";
assert.throws(()=>validateMotionDocument(invalidLoop),/entry timing/);
assert.throws(()=>periodicNestedTrack(track(0,1e-6),[{start:1,reset:0}],0,10,1e-6),/too short/);
console.log("Loop card animation: shared duration/delays, continuous foreground seam, opt-in, Refresh, toggle off, Clear and saved settings passed");
const shortCurve=track(.2,1.2);shortCurve.keyframes[1].easing={type:"CUSTOM_CUBIC_BEZIER",easingFunctionCubicBezier:{x1:.3,y1:.1,x2:.65,y2:.9}};
const tiledCurve=periodicNestedTrack(shortCurve,[{start:9,reset:8}],0,10,1.2);
for(let t=.03;t<.18;t+=.03)assert(Math.abs(sample(tiledCurve.keyframes,t)-sample(shortCurve.keyframes,t+1))<1e-6,"Cubic clipping across the outer seam preserves easing");
for(let t=.45;t<1.1;t+=.07)assert(Math.abs(sample(tiledCurve.keyframes,t)-sample(shortCurve.keyframes,t-.2))<1e-6,"Every repeated cubic retains its easing");


// Authored 4834 reveal easing: Loop On / offset -0.40 can produce a
// sub-microsecond boundary fragment with almost zero dy, not a turning point.
const nativeReveal=track(0,.7);
nativeReveal.keyframes[1].easing={type:"CUSTOM_CUBIC_BEZIER",easingFunctionCubicBezier:{x1:.2199999988079071,y1:1,x2:.36000001430511475,y2:1}};
for(const start of [4,5.2,15.3,16.5,17.7]){
 const replay=periodicNestedTrack(nativeReveal,[{start,reset:start-2.3}],-.4,18,1.2);
 assert(replay.keyframes.every(k=>Number.isFinite(k.timelinePosition)&&k.timelinePosition>=0&&k.timelinePosition<=18));
 assert(replay.keyframes.every((k,i)=>i===0||Math.round(k.timelinePosition*1e6)>Math.round(replay.keyframes[i-1].timelinePosition*1e6)),`Signed offset is representable at native microsecond precision: start=${start}`);
 for(let time=.013;time<18;time+=.037){
  const age=((time-(start-.4))%18+18)%18;
  const phase=age%1.2;
  const expected=age>=18-1.9?0:sample(nativeReveal.keyframes,phase);
  assert(Math.abs(sample(replay.keyframes,time)-expected)<1e-8,`Signed offset preserves the authored cubic playback, including the flat tail: start=${start} time=${time}`);
 }
}
// Equal endpoints with a real non-flat excursion cannot be replaced by HOLD
// or LINEAR. Retain the explicit representability error.
const excursion=track(0,1);
excursion.keyframes[1].easing={type:"CUSTOM_CUBIC_BEZIER",easingFunctionCubicBezier:{x1:1/3,y1:1,x2:2/3,y2:-4/3}};
assert.throws(()=>periodicNestedTrack(excursion,[{start:0,reset:0},{start:.50001,reset:.50001}],0,1),/turning point crosses the loop seam/);
console.log("Native flat cubic tail: signed loop offset preserves playback; genuine excursions still reject");

// Desktop permits wrapping path trims that its public write API rejects.
const wrappedPath=node(),wrappedRoot=node([wrappedPath]);
wrappedPath.manualKeyframeTracks.PATH_TRIM_START={baseValue:{type:"FLOAT",value:0},keyframes:[key(0,1.25),key(1.2,.25)]};
wrappedPath.manualKeyframeTracks.PATH_TRIM_END={baseValue:{type:"FLOAT",value:1},keyframes:[key(0,.5),key(1.2,1.5)]};
wrappedPath.manualKeyframeTracks.OPACITY=track(0,1.2);
const wrappedStart=copy(wrappedPath.manualKeyframeTracks.PATH_TRIM_START),wrappedEnd=copy(wrappedPath.manualKeyframeTracks.PATH_TRIM_END);
const untouchedTrimRecovery=await captureNestedState([wrappedRoot]);
await untouchedTrimRecovery();
assert.deepEqual(wrappedPath.manualKeyframeTracks.PATH_TRIM_START,wrappedStart,"Unchanged rollback retains the authored 125% notation");
assert.deepEqual(wrappedPath.manualKeyframeTracks.PATH_TRIM_END,wrappedEnd,"Unchanged rollback retains the authored 150% notation");
const wrappedWrite=wrappedPath.applyManualKeyframeTrack;
wrappedPath.applyManualKeyframeTrack=function(field,input){
 if(["PATH_TRIM_START","PATH_TRIM_END"].includes(field.name)&&input.keyframes.some(key=>key.value.value<0||key.value.value>1))throw new Error("path trim must be less than or equal to 1");
 return wrappedWrite.call(this,field,input);
};
for(let pass=0;pass<2;pass++){
 const [snapshot]=await prepareNestedMotion([wrappedRoot],true);
 assert.equal(snapshot.unsupported.length,0);
 assert.equal(nestedMotionNotice([snapshot]),"");
 await applyNestedMotionBatch([{rootId:wrappedRoot.id,snapshot,shift:0,enabled:true,repeat:true,loopEnd:5}]);
 for(const [field,authored] of [["PATH_TRIM_START",wrappedStart],["PATH_TRIM_END",wrappedEnd]]){
  const actual=wrappedPath.manualKeyframeTracks[field];
  assert(actual.keyframes.every(k=>k.value.value>=0&&k.value.value<=1));
  for(let t=.013;t<4.99;t+=.017){
   const phase=(t%1.25)*1.2/1.25;
   if(phase<.00002||1.2-phase<.00002)continue;
   const diff=sample(actual.keyframes,t)-sample(authored.keyframes,phase);
   assert(Math.abs(diff-Math.round(diff))<2e-5,"Wrapping trims repeat their authored visible phase");
  }
 }
 assert(wrappedPath.manualKeyframeTracks.OPACITY.keyframes.length>2,"Other inner tracks still loop");
}
await restoreNestedMotion(wrappedRoot);
assert.deepEqual(trackContents(wrappedPath.manualKeyframeTracks.PATH_TRIM_START),normalizeWrappingPathTrim(wrappedStart));
assert.deepEqual(trackContents(wrappedPath.manualKeyframeTracks.PATH_TRIM_END),normalizeWrappingPathTrim(wrappedEnd));
assert.deepEqual(trackContents(wrappedPath.manualKeyframeTracks.OPACITY),track(0,1.2));
assert.equal(collectManualTracks({PATH_TRIM_START:track(0,1.2)}).length,1);
assert.equal(collectManualTracks({PATH_TRIM_START:{baseValue:{type:"FLOAT",value:0},keyframes:[key(0,0),key(1.2,1)]}}).length,1,"Valid path trims remain editable");
console.log("Native wrapping path trims: Apply/Refresh repeat visible phases and Clear restores authored timing");

// Independent phase oracle for all six tracks on the exact reported FLOW.
const {share4909AuthoredCards}=await import("./test-fixtures/share-4909-authored-cards");
const flowFixture=share4909AuthoredCards.find(card=>card.name==="02 / FLOW");
const flowTracks=[];
const collectFlow=layer=>{
 for(const field of ["PATH_TRIM_START","PATH_TRIM_END"])if(layer.tracks[field])flowTracks.push({field,input:layer.tracks[field]});
 for(const child of layer.children??[])collectFlow(child);
};collectFlow(flowFixture);
assert.equal(flowTracks.length,6);
const phaseError=(a,b)=>Math.abs((a-b)-Math.round(a-b));
const flowChildren=flowTracks.map(({field,input})=>{
 const child=node();child.manualKeyframeTracks[field]=copy(input);
 const write=child.applyManualKeyframeTrack;
 child.applyManualKeyframeTrack=function(field,input){
  assert([...input.keyframes.map(k=>k.value.value),input.baseValue?.value??0].every(v=>v>=0&&v<=1),"Exact FLOW writes obey native trim validation");
  return write.call(this,field,input);
 };return child;
});
const flowRoot=node(flowChildren);let flowFirst;
for(let pass=0;pass<2;pass++){
 const [snapshot]=await prepareNestedMotion([flowRoot],true);
 assert.equal(snapshot.unsupported.length,0);
 await applyNestedMotionBatch([{rootId:flowRoot.id,snapshot,enabled:true,repeat:true,shift:0,loopEnd:6}]);
 const actual=flowChildren.map((child,i)=>trackContents(child.manualKeyframeTracks[flowTracks[i].field]));
 if(flowFirst)assert.deepEqual(actual,flowFirst,"Exact FLOW Refresh does not accumulate conversions or repeats");else flowFirst=actual;
 for(let i=0;i<actual.length;i++)for(let time=.0001;time<6;time+=1/120){
  const expected=sample(flowTracks[i].input.keyframes,time%1.2);
  assert(phaseError(sample(actual[i].keyframes,time),expected)<2e-5,"All six exact FLOW trims repeat their original visible phase at 120Hz");
 }
}
await restoreNestedMotion(flowRoot);
for(let i=0;i<flowChildren.length;i++)for(let time=.0001;time<1.2;time+=1/120)
 assert(phaseError(sample(flowChildren[i].manualKeyframeTracks[flowTracks[i].field].keyframes,time),sample(flowTracks[i].input.keyframes,time))<2e-5,"FLOW Clear restores authored visible phases and timing");
// Reported native scene: outer 5s cannot wrap a free-running 1.2s inner loop.
// At 5s the old compiler stopped 0.2s into a new lap, then jumped to phase zero.
const flowBeforeFit=flowChildren.map((child,i)=>trackContents(child.manualKeyframeTracks[flowTracks[i].field]));
for(let pass=0;pass<2;pass++){
 const [snapshot]=await prepareNestedMotion([flowRoot],true);
 await applyNestedMotionBatch([{rootId:flowRoot.id,snapshot,enabled:true,repeat:true,shift:0,loopEnd:5}]);
 for(let i=0;i<flowTracks.length;i++){
  const actual=flowChildren[i].manualKeyframeTracks[flowTracks[i].field];
  for(let time=.0001;time<5;time+=1/120){
   const authoredPhase=(time%1.25)*1.2/1.25;
   assert(phaseError(sample(actual.keyframes,time),sample(flowTracks[i].input.keyframes,authoredPhase))<2e-5,"5s FLOW fits four complete cycles and scales all tracks together");
  }
  assert.equal(sample(actual.keyframes,5),sample(actual.keyframes,0),"Every FLOW track returns to exactly the same global-seam pose");
  // The dark paths are authored as closed loops. The cream path's end trim
  // changes from 200% to 85%, so its original lap deliberately resets length.
  if(i>=2)assert(phaseError(sample(actual.keyframes,5-.000002),sample(actual.keyframes,.000002))<2e-5,"Closed dark FLOW paths stay continuous on both sides of the global seam");
 }
}
await restoreNestedMotion(flowRoot);
flowChildren.forEach((child,i)=>assert.deepEqual(trackContents(child.manualKeyframeTracks[flowTracks[i].field]),flowBeforeFit[i],"Clear recovers 1.2s timing after fitting a 5s scene"));
const fittedDelay=fittedNestedLoop(shortOriginal,5,1.2);
for(let cycle=0;cycle<4;cycle++){
 assert(Math.abs(sample(fittedDelay.keyframes,(cycle+.5/1.2)*1.25)-50)<1e-6,"Shorter reveals and initial delays scale with the whole card");
 assert.equal(sample(fittedDelay.keyframes,(cycle+1/1.2)*1.25),100,"Shorter tracks still hold until the next fitted lap");
}
assert.deepEqual(fittedNestedLoop({keyframes:[]},5,1.2),{keyframes:[]});
assert.throws(()=>fittedNestedLoop(shortOriginal,Infinity,1.2),/Invalid/);
console.log("Reported FLOW seam: 5s scene / 1.2s card fits four laps, exact endpoints and 120Hz seam continuity; Refresh/Clear passed");
const trimCubic={baseValue:{type:"FLOAT",value:0},keyframes:[key(.1,-.25),{...key(1.7,2.25),easing:{type:"CUSTOM_CUBIC_BEZIER",easingFunctionCubicBezier:{x1:.22,y1:0,x2:.75,y2:1}}}]};
const boundedCubic=normalizeWrappingPathTrim(trimCubic);
for(let time=.1001;time<1.7;time+=.0017)
 assert(phaseError(sample(boundedCubic.keyframes,time),sample(trimCubic.keyframes,time))<3e-5,"Wrapping cubic keeps the original curve, including negative trim positions");
const keyCrossing={keyframes:[key(0,.5),key(.6,1),key(1.2,1.5)]};
const normalizedCrossing=normalizeWrappingPathTrim(keyCrossing);
for(let time=.0001;time<1.2;time+=.013)
 assert(phaseError(sample(normalizedCrossing.keyframes,time),sample(keyCrossing.keyframes,time))<2e-5,"Crossings exactly on authored keys do not tween backwards");
const springTrim={keyframes:[key(0,.5),{...key(1.2,1.5),easing:{type:"CUSTOM_SPRING",easingFunctionSpring:{mass:1,stiffness:100,damping:10}}}]};
assert.equal(collectManualTracks({PATH_TRIM_START:springTrim}).length,0,"Unrepresentable wrapping springs remain untouched");
console.log("Exact FLOW: six native tracks, five repeats at 120Hz, Refresh/Clear, negative/cubic and authored-key crossings passed");

// Real-host storage limit: large originals plus generated tracks cannot occupy
// one plugin-data entry. Recreate plugin execution with only persisted nodes.
{
  const markerKey='orbit-entry-motion';
  const makeLarge=()=>{
    const child=node(),root=node([child]);
    child.manualKeyframeTracks.TRANSLATION_X={baseValue:{type:'FLOAT',value:0},keyframes:Array.from({length:900},(_,i)=>key(i/900,i))};
    child.manualKeyframeTracks.effects={0:{properties:{['☀️🎬'.repeat(4200)]:track()}}};
    const storage=new Map();let calls=0,failAt=0,maxBytes=0;
    child.getPluginData=k=>storage.get(k)??'';
    child.getPluginDataKeys=()=>[...storage.keys()];
    child.setPluginData=(k,v)=>{
      const bytes=Buffer.byteLength(k+v,'utf8');maxBytes=Math.max(bytes,maxBytes);
      assert.ok(bytes<=100000,`Figma pluginData limit: ${bytes}`);
      assert.ok(!/^[\uDC00-\uDFFF]/u.test(v)&&!/[\uD800-\uDBFF]$/u.test(v),'Never split surrogate pairs');
      calls++;if(calls===failAt)throw new Error('storage fault '+calls);
      if(v)storage.set(k,v);else storage.delete(k);
    };
    return {child,root,storage,reset(n=0){calls=0;failAt=n;},get calls(){return calls;},get maxBytes(){return maxBytes;}};
  };
  const initial=makeLarge(),original=copy(initial.child.manualKeyframeTracks);
  let [baseline]=await prepareNestedMotion([initial.root],true);
  const raw=JSON.stringify({version:1,tracks:baseline.layers[0].tracks.map(({field,input})=>({field,original:input,applied:input}))});
  assert.ok(Buffer.byteLength(raw)>100000,'Fixture must reproduce old single-entry failure');
  assert.throws(()=>initial.child.setPluginData(markerKey,raw),/pluginData limit/);
  initial.reset();await applyNestedMotion(initial.root.id,baseline,2,true);
  assert.equal(JSON.parse(initial.child.getPluginData(markerKey)).version,2);
  const firstCalls=initial.calls;
  for(let i=0;i<4;i++){
    // All state comes from persisted node data; no baseline survives a restart.
    const [restarted]=await prepareNestedMotion([initial.root],true);
    assert.deepEqual(restarted.layers[0].tracks,baseline.layers[0].tracks);
    await applyNestedMotion(initial.root.id,restarted,3+i,true);
    assert.equal(initial.child.manualKeyframeTracks.TRANSLATION_X.keyframes[0].timelinePosition,3+i);
  }
  const restore=await captureNestedState([initial.root]);
  const [again]=await prepareNestedMotion([initial.root],true);
  await applyNestedMotion(initial.root.id,again,9,true);await restore();
  assert.equal(initial.child.manualKeyframeTracks.TRANSLATION_X.keyframes[0].timelinePosition,6);
  await restoreNestedMotion(initial.root);
  assert.deepEqual(collectManualTracks(initial.child.manualKeyframeTracks),collectManualTracks(original));
  assert.equal(initial.storage.size,0,'Clear removes all marker chunks');
  // Check every failing plugin-data call, including pointer commit and cleanup,
  // on first Apply, Refresh and Clear. Cleanup errors may leave unreachable
  // chunks; subsequent successful operation must collect them.
  let injected=0;
  for(const mode of ['apply','refresh','clear']){
    const probe=makeLarge();const [p]=await prepareNestedMotion([probe.root],true);
    if(mode!=='apply')await applyNestedMotion(probe.root.id,p,2,true);
    probe.reset();if(mode==='clear')await restoreNestedMotion(probe.root);else await applyNestedMotion(probe.root.id,p,3,true);
    const total=probe.calls;
    for(let fault=1;fault<=total;fault++){
      const env=makeLarge();const [saved]=await prepareNestedMotion([env.root],true);
      if(mode!=='apply')await applyNestedMotion(env.root.id,saved,2,true);
      const before=collectManualTracks(env.child.manualKeyframeTracks);
      env.reset(fault);let rejected=false;
      try{if(mode==='clear')await restoreNestedMotion(env.root);else await applyNestedMotion(env.root.id,saved,3,true);}
      catch(error){assert.match(error.message,/storage fault/);assert.doesNotMatch(error.message,/rollback failed/);rejected=true;}
      if(rejected)assert.deepEqual(collectManualTracks(env.child.manualKeyframeTracks),before,'Fault rollback restores exact motion');
      env.reset();const [retry]=await prepareNestedMotion([env.root],true);
      assert.deepEqual(retry.layers[0].tracks,saved.layers[0].tracks,'Failure never replaces original baseline');
      await applyNestedMotion(env.root.id,retry,4,true);await restoreNestedMotion(env.root);
      assert.deepEqual(collectManualTracks(env.child.manualKeyframeTracks),saved.layers[0].tracks);
      assert.equal(env.storage.size,0,'Retry and Clear collect failed-write chunks');injected++;
    }
  }
  // A plugin killed while staging never publishes the incomplete bank. On
  // restart a valid baseline remains readable, and the next write collects it.
  const interrupted=makeLarge();const [stable]=await prepareNestedMotion([interrupted.root],true);
  await applyNestedMotion(interrupted.root.id,stable,2,true);
  const active=JSON.parse(interrupted.child.getPluginData(markerKey));
  interrupted.storage.set(`${markerKey}:${active.bank==='a'?'b':'a'}:999`,'abandoned staging 🎬');
  const [reopened]=await prepareNestedMotion([interrupted.root],true);
  assert.deepEqual(reopened.layers[0].tracks,stable.layers[0].tracks);
  await applyNestedMotion(interrupted.root.id,reopened,3,true);
  assert.ok(![...interrupted.storage.keys()].some(k=>k.endsWith(':999')));
  await restoreNestedMotion(interrupted.root);assert.equal(interrupted.storage.size,0);
  // Every chunk write may invalidate the native handle, just like track writes.
  const staleLarge=makeLarge(),normalGet=figma.getNodeByIdAsync;let epoch=0;
  figma.getNodeByIdAsync=async id=>{
    const current=await normalGet(id);if(id!==staleLarge.child.id)return current;
    const captured=epoch;
    return new Proxy(current,{get(target,property){
      if(property==='setPluginData'||property==='applyManualKeyframeTrack')return (...args)=>{
        assert.equal(captured,epoch,'Re-resolve the handle for every chunk mutation');
        const result=target[property](...args);epoch++;return result;
      };
      return target[property];
    }});
  };
  try{
    const [s]=await prepareNestedMotion([staleLarge.root],true);
    await applyNestedMotion(staleLarge.root.id,s,2,true);
    await applyNestedMotion(staleLarge.root.id,s,3,true);await restoreNestedMotion(staleLarge.root);
    assert.equal(staleLarge.storage.size,0);
  }finally{figma.getNodeByIdAsync=normalGet;}
  // Unknown historical v2 formats must stop before mutating authored tracks.
  for(const header of [{version:2,chunks:7},{version:2,bank:'a',count:2,length:100,checksum:0},{version:2,bank:'other',count:1,length:5,checksum:0}]){
    const legacy=makeLarge(),before=copy(legacy.child.manualKeyframeTracks);
    legacy.storage.set(markerKey,JSON.stringify(header));
    await assert.rejects(prepareNestedMotion([legacy.root],true),/saved nested animation timing/);
    assert.deepEqual(legacy.child.manualKeyframeTracks,before);assert.equal(legacy.calls,0);
  }
  // A throwing native pointer commit may nevertheless have changed state.
  // Rollback must see intact active chunks, then restore the previous baseline.
  for(const mode of ['apply','refresh','clear']){
    const uncertain=makeLarge();const [base]=await prepareNestedMotion([uncertain.root],true);
    if(mode!=='apply')await applyNestedMotion(uncertain.root.id,base,2,true);
    const before=collectManualTracks(uncertain.child.manualKeyframeTracks),setter=uncertain.child.setPluginData;
    let pending=true;
    uncertain.child.setPluginData=(k,v)=>{setter(k,v);if(k===markerKey&&pending){pending=false;throw new Error('commit changed state before throwing');}};
    await assert.rejects(mode==='clear'?restoreNestedMotion(uncertain.root):applyNestedMotion(uncertain.root.id,base,3,true),error=>
      /commit changed state/.test(error.message)&&!/rollback failed/.test(error.message));
    assert.deepEqual(collectManualTracks(uncertain.child.manualKeyframeTracks),before);
    const [after]=await prepareNestedMotion([uncertain.root],true);assert.deepEqual(after.layers[0].tracks,base.layers[0].tracks);
    await applyNestedMotion(uncertain.root.id,after,4,true);await restoreNestedMotion(uncertain.root);assert.equal(uncertain.storage.size,0);
  }
  for(const dropPointer of [false,true]){
    const silent=makeLarge();const [base]=await prepareNestedMotion([silent.root],true);
    await applyNestedMotion(silent.root.id,base,2,true);
    const before=collectManualTracks(silent.child.manualKeyframeTracks),setter=silent.child.setPluginData;let pending=true;
    silent.child.setPluginData=(k,v)=>{
      if(pending&&(dropPointer?k===markerKey:k!==markerKey)&&v){pending=false;return;}
      setter(k,v);
    };
    await assert.rejects(applyNestedMotion(silent.root.id,base,3,true),error=>/did not preserve saved/.test(error.message)&&!/rollback failed/.test(error.message));
    assert.deepEqual(collectManualTracks(silent.child.manualKeyframeTracks),before);
    const [after]=await prepareNestedMotion([silent.root],true);assert.deepEqual(after.layers[0].tracks,base.layers[0].tracks);
    await restoreNestedMotion(silent.root);assert.equal(silent.storage.size,0);
  }
  // Corrupt pointer writes are restored from the captured previous pointer,
  // rather than asking the general rollback path to parse malformed JSON.
  for(const corruptKind of ['truncated','missing-bank','wrong-bank','corrupt-then-throw'])for(const mode of ['apply','refresh','clear']){
    const corrupt=makeLarge();const [base]=await prepareNestedMotion([corrupt.root],true);
    if(mode!=='apply')await applyNestedMotion(corrupt.root.id,base,2,true);
    const before=collectManualTracks(corrupt.child.manualKeyframeTracks),previous=corrupt.child.getPluginData(markerKey),setter=corrupt.child.setPluginData;
    let pending=true;
    corrupt.child.setPluginData=(k,v)=>{
      if(k===markerKey&&pending){
        pending=false;
        const damaged=corruptKind==='missing-bank'?JSON.stringify({version:2,count:2}):
          corruptKind==='wrong-bank'?JSON.stringify({version:2,bank:'wrong',count:1,length:1,checksum:0}):v?v.slice(0,-1):'{';
        setter(k,damaged);
        if(corruptKind==='corrupt-then-throw')throw new Error('pointer corrupted before throwing');
        return;
      }
      setter(k,v);
    };
    await assert.rejects(mode==='clear'?restoreNestedMotion(corrupt.root):applyNestedMotion(corrupt.root.id,base,3,true),error=>
      /did not preserve saved|pointer corrupted before throwing/.test(error.message)&&!/rollback failed/.test(error.message));
    assert.equal(corrupt.child.getPluginData(markerKey),previous,'Exact known-good pointer restored');
    assert.deepEqual(collectManualTracks(corrupt.child.manualKeyframeTracks),before);
    const [after]=await prepareNestedMotion([corrupt.root],true);assert.deepEqual(after.layers[0].tracks,base.layers[0].tracks);
    await applyNestedMotion(corrupt.root.id,after,4,true);await restoreNestedMotion(corrupt.root);assert.equal(corrupt.storage.size,0);
  }
  const damaged=makeLarge();const [d]=await prepareNestedMotion([damaged.root],true);
  await applyNestedMotion(damaged.root.id,d,2,true);
  const header=JSON.parse(damaged.child.getPluginData(markerKey)),partKey=`${markerKey}:${header.bank}:0`,part=damaged.storage.get(partKey);
  damaged.storage.delete(partKey);
  await assert.rejects(prepareNestedMotion([damaged.root],true),/Missing saved/);
  damaged.storage.set(partKey,part.replace('version','versioX'));
  await assert.rejects(prepareNestedMotion([damaged.root],true),/Damaged saved/);
  console.log(`Nested chunk storage: ${Buffer.byteLength(raw)}-byte fixture; ${firstCalls} staged writes; ${injected} injected failures; restart, Unicode, rollback, Clear and corruption checks passed`);
}
