// @ts-ignore Node types are only needed by this esbuild test entry.
import assert from "node:assert/strict";
import { referencePresets, activeReferencePresets } from "./reference-catalog";
import { freshPreset, editorFor, settingsFromSaved } from "./catalog";
import { referenceDefaults } from "./reference-controls";
import { referenceScene } from "./reference-engine";
import { parseSettingsJson } from "./settings-json";
// Fixtures intentionally exercise backwards-compatible, pre-v2 JSON import.
const serializeSettingsJson=(settings:unknown)=>JSON.stringify(settings,null,2);
import { preferredSettings } from "./preferred-numbers";
import { cloneData } from "./clone-data";

assert.equal(activeReferencePresets.length,7);
assert.deepEqual(activeReferencePresets.filter(p=>p.mode==="rfCarousel").map(p=>p.label),["Row 01","Row 02","Row 03"]);
assert.deepEqual(activeReferencePresets.filter(p=>p.mode==="rfStack").map(p=>p.label),["Stack 01","Stack 02"]);
assert(!activeReferencePresets.some(p=>p.label==="Cilinder"),"Previous Cilinder is retired");
assert.equal(activeReferencePresets.filter(p=>p.mode==="rfCarousel").length,3);
for(const preset of activeReferencePresets.filter(p=>p.mode==="rfCarousel")){
  assert(editorFor(freshPreset(preset.id)).quickControls?.includes("reference.direction"),"Row direction stays available as a quick shortcut");
  assert(editorFor(freshPreset(preset.id)).quickControls?.includes("reference.scaleFocus"),"Row exposes the larger edge as a quick control");
  assert(editorFor(freshPreset(preset.id)).quickControls?.includes("reference.gap"),"Row exposes gap as a quick control");
  assert(editorFor(freshPreset(preset.id)).quickControls?.includes("reference.visible"),"Row exposes visible cards as a quick control");
  assert(editorFor(freshPreset(preset.id)).controls?.includes("reference.tiltStyle"),"Row tilt style is editable");
  assert.equal(freshPreset(preset.id).reference?.direction,"right","Every Row recipe previews moving right by default");
  const settings=freshPreset(preset.id),sources=[{width:120,height:160},{width:120,height:160}];
  const atVisible=(visible:number)=>referenceScene({...settings,reference:{...settings.reference,visible,scaleCenter:"off"}},sources,720,400,1.3);
  const three=atVisible(3),six=atVisible(6);
  assert(three.length>0&&six.length>0);
  assert(Math.abs(six[0].width*2-three[0].width)<.01,"Doubling visible cards halves the Row camera scale");
  assert(six.length>sources.length,"Row can repeat sources to populate the requested view");
}
// Center focus must survive settings import and stay symmetric in both axes.
const rowOne=freshPreset("reference-carousel-05");
assert.equal(rowOne.reference?.scaleFocus,"center");
assert.equal(rowOne.reference?.scaleCenter,"on");
assert.equal(rowOne.reference?.depthFade,25);
for(const id of ["reference-carousel-05","reference-carousel-11"] as const){
  for(const direction of ["right","left","up","down"]){
    const settings=freshPreset(id);
    settings.reference={...settings.reference,scaleFocus:"center",scaleCenter:"on",centerScale:1.6,depthFade:25,direction,visible:5,stagger:0};
    assert.equal(parseSettingsJson(serializeSettingsJson(settings),freshPreset("circle")).reference?.scaleFocus,"center");
    const cards=referenceScene(settings,Array.from({length:5},()=>({width:100,height:100})),720,720,0);
    const vertical=direction==="up"||direction==="down";
    const offset=(card:typeof cards[number])=>(vertical?card.y:card.x)-360;
    const center=cards.find(card=>Math.abs(offset(card))<.01)!;
    const left=cards.filter(card=>offset(card)<-.01).sort((a,b)=>offset(b)-offset(a))[0];
    const right=cards.filter(card=>offset(card)>.01).sort((a,b)=>offset(a)-offset(b))[0];
    assert(center&&left&&right,"Center focus populates both sides");
    assert(center.width>left.width&&center.width>right.width,"Center is largest");
    assert(Math.abs(left.width-right.width)<.001,"Both sides shrink symmetrically");
    assert((center.opacity??1)>(left.opacity??1),"Side cards fade behind center");
    assert.equal(center.shade??0,0,"Center fade uses transparency without a black backing");
  }
}
// Compare actual card edges throughout the cycle, including center handoffs.
for(const direction of ["left","right","up","down"]){
  const settings=freshPreset("reference-carousel-05");
  settings.reference={...settings.reference,direction,visible:6};
  const sources=Array.from({length:8},(_,i)=>({width:i%2?102:101,height:101}));
  const vertical=direction==="up"||direction==="down";
  const expectedGap=Number(settings.reference.gap)*10.8*(vertical?947:1678)/(6*600);
  for(let step=0;step<=120;step++){
    const cards=referenceScene(settings,sources,1678,947,settings.motion.duration*step/120)
      .sort((a,b)=>(vertical?a.y-b.y:a.x-b.x));
    assert(cards.length>=2,"Row remains populated throughout the cycle");
    for(let i=1;i<cards.length;i++){
      const a=cards[i-1],b=cards[i];
      const gap=vertical?b.y-a.y-(a.height+b.height)/2:b.x-a.x-(a.width+b.width)/2;
      assert(Math.abs(gap-expectedGap)<.001,`Equal edge gaps in ${direction} at ${step}: ${gap}`);
    }
  }
  const before=referenceScene(settings,sources,1678,947,0);
  const after=referenceScene(settings,sources,1678,947,.000001);
  for(const card of before.filter(card=>vertical?card.y-card.height/2>0&&card.y+card.height/2<947:card.x-card.width/2>0&&card.x+card.width/2<1678)){
    const next=after.find(other=>other.source===card.source&&Math.abs(other.x-card.x)+Math.abs(other.y-card.y)<1);
    assert(next,"Center handoff stays continuous");
  }
}
for(const preset of activeReferencePresets.filter(p=>p.mode==="rfStack"))
  assert(["up","down"].includes(String(freshPreset(preset.id).reference?.direction)),"Stack keeps its vertical source direction");
assert(!activeReferencePresets.some(p=>/flicker|scale|swipe|board/.test(p.id)));
assert.equal(new Set(activeReferencePresets.map(p=>p.label)).size,7);
const vortexPreset=activeReferencePresets.find(p=>p.label==="Vortex")!;
const vortexSettings=freshPreset(vortexPreset.id);
const vortexSources=[{width:120,height:160},{width:120,height:160}];
const vortexBefore=referenceScene(vortexSettings,vortexSources,720,400,1.3);
const vortexAfter=referenceScene({...vortexSettings,reference:{...vortexSettings.reference,spacing:Number(vortexSettings.reference!.spacing)*2}},vortexSources,720,400,1.3);
assert(editorFor(vortexSettings).quickControls?.includes("reference.spacing"));
assert.equal(vortexBefore.length,vortexAfter.length);
vortexBefore.forEach((card,i)=>{
  const changed=vortexAfter[i];
  assert(Math.abs((changed.x-360)-2*(card.x-360))<.001,"Gap scales horizontal spacing");
  assert(Math.abs((changed.y-200)-2*(card.y-200))<.001,"Gap scales vertical spacing");
  assert(Math.abs(changed.width-card.width)<.001,"Gap preserves card size");
});
const ringPreset=activeReferencePresets.find(p=>p.label==="Circle")!;
const ringSchema=editorFor(freshPreset(ringPreset.id));
for(const path of ["reference.radiusX","reference.radiusY"]){
  assert(ringSchema.quickControls?.includes(path),`Circle exposes ${path} in quick settings`);
  assert(ringSchema.controls?.includes(path),`Circle keeps ${path} in full settings`);
}
for(const preset of activeReferencePresets){
  const settings=freshPreset(preset.id),renamed={...settings,preset:"circle" as const};
  const sources=[{width:120,height:160},{width:120,height:160}];
  assert.deepEqual(referenceScene(settings,sources,720,400,1.3),referenceScene(renamed,sources,720,400,1.3),"Preset ID must not choose the renderer or its parameters");
  assert.deepEqual(parseSettingsJson(serializeSettingsJson(renamed),freshPreset("circle")),renamed,"Renderer persists independently of the preset ID");
}

for(const preset of referencePresets){
  const settings=freshPreset(preset.id),schema=editorFor(settings);
  assert.deepEqual(settings,preferredSettings(settings),preset.label+": preferred setting values");
  assert.deepEqual(parseSettingsJson(serializeSettingsJson(settings),freshPreset("orbit-3d-ring")),settings,`${preset.label}: JSON round trip from another family`);
  const quick=schema.quickControls??[],paths=schema.controls??[];
  assert(quick.every(path=>paths.includes(path)),`${preset.label}: quick controls are shortcuts to full controls`);
  assert.deepEqual(paths.filter(path=>path.startsWith("reference.")).sort(),Object.keys(referenceDefaults(preset.id)).map(key=>`reference.${key}`).sort(),`${preset.label}: every active parameter has a full control`);
  assert(schema.sections?.find(section=>section.id==="other")?.paths.includes("other.copyJson"));
  assert(!schema.quickControls?.some(path=>path.includes("Json")));
  const saved=Object.fromEntries(Object.entries(settings.reference!).map(([key,value])=>[`reference.${key}`,value]));
  assert.deepEqual(settingsFromSaved({...saved,preset:preset.id},settings).reference,settings.reference,`${preset.label}: persistence`);
  const sources=Array.from({length:5},(_,i)=>({width:100+i*30,height:180-i*10}));
  for(const [width,height] of [[400,720],[720,400],[4000,2800]])for(const progress of [0,.11,.499,.9,.999999,1]){
    const scene=referenceScene(settings,sources,width,height,progress*settings.motion.duration);
    for(const card of scene){
      for(const key of ["x","y","width","height","rotation","radius"] as const)assert(Number.isFinite(card[key]),`${preset.label}: finite ${key}`);
      assert(card.width>0&&card.height>0&&card.radius>=0);
      assert((card.opacity??1)>=0&&(card.opacity??1)<=1);
    }
  }
  const invalid=cloneData(settings);invalid.reference!.cornerRadius=-1;
  assert.throws(()=>parseSettingsJson(serializeSettingsJson(invalid),settings),/cornerRadius/);
  if("direction"in settings.reference!){invalid.reference={...settings.reference,direction:"not-a-direction"};assert.throws(()=>parseSettingsJson(serializeSettingsJson(invalid),settings),/direction/);}
}
console.log(`Native preset schema: ${referencePresets.length} presets; JSON, persistence, controls, sizes and invalid values passed`);
