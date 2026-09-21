import ts from "typescript";
import { build } from "esbuild";
import assert from "node:assert/strict";
const entries=["reference-engine","catalog","motif-catalog","motif-controls"],api={};
for(const name of entries){const built=await build({entryPoints:[`src/${name}.ts`],bundle:true,write:false,platform:"node",format:"esm"});Object.assign(api,await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString("base64")}`));}
const response=await fetch("https://reelfolio.io/_next/static/chunks/0n139tzokhw4h.js");assert(response.ok);
const source=await response.text(),ast=ts.createSourceFile("motifs.js",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),helpers={},painters={};
function visit(node){if(ts.isFunctionDeclaration(node)&&["r","h","o","n"].includes(node.name?.text)&&!helpers[node.name.text])helpers[node.name.text]=node.getText(ast);if(ts.isPropertyAssignment(node)&&api.motifPresets.some(p=>p.templateId===node.name.getText(ast)))painters[node.name.getText(ast)]=node.initializer.getText(ast);ts.forEachChild(node,visit);}visit(ast);
assert.equal(Object.keys(painters).length,api.motifPresets.length);
const wrap=(x,n=1)=>((x%n)+n)%n;
const utils={clamp01:x=>Math.max(0,Math.min(1,x)),wrap01:wrap,wrapIndex:wrap,loopUnit:(w,h)=>Math.min(w,h)/100,slotAspect(settings,media){if(settings.cropAspectRatio==="natural"){const ratios=media.map(m=>m.width/m.height).sort((a,b)=>a-b);return ratios.length%2?ratios[ratios.length>>1]:(ratios[ratios.length/2-1]+ratios[ratios.length/2])/2;}const [w,h]=settings.cropAspectRatio.split(":").map(Number);return w/h;},stepAt:(t,n)=>{const x=wrap(t)*n,index=Math.floor(x);return {index,local:x-index};},easeWith:(name,t)=>name==="linear"?t:name==="snappy"?(t>=1?1:1-2**(-10*t)):name==="elastic"?(t<=0?0:t>=1?1:2**(-10*t)*Math.sin(2*Math.PI/3*(10*t-.75))+1):t<.5?4*t*t*t:1-(-2*t+2)**3/2,
drawMediaCover(ctx,media,rect,settings,options){let {x,y,w,h}=rect;if(settings.cropAspectRatio==="natural"&&!options.tiled){const fit=Math.min(w/media.width,h/media.height),nw=media.width*fit,nh=media.height*fit;x+=(w-nw)/2;y+=(h-nh)/2;w=nw;h=nh;}ctx.emit(media.id,x+w/2,y+h/2,w,h,Math.min(options.radius,w/2,h/2),options.alpha??1);}};
const directions={right:{x:1,y:0},left:{x:-1,y:0},down:{x:0,y:1},up:{x:0,y:-1},"down-right":{x:1,y:1},"down-left":{x:-1,y:1},"up-right":{x:1,y:-1},"up-left":{x:-1,y:-1}};
const oracle=new Function("e","i",`const m=new Map(),f=Math.PI*2;${Object.values(helpers).join("\n")} return {${Object.entries(painters).map(([id,fn])=>`${id}:${fn}`).join(",")}};`)(utils,directions);
function recorder(){let state={x:0,y:0,rotation:0},stack=[];return {cards:[],save(){stack.push({...state})},restore(){state=stack.pop()},translate(x,y){state.x+=x;state.y+=y},rotate(r){state.rotation+=r},emit(source,x,y,width,height,radius,opacity){const c=Math.cos(state.rotation),s=Math.sin(state.rotation);this.cards.push({source,x:state.x+x*c-y*s,y:state.y+x*s+y*c,width,height,radius,opacity,rotation:state.rotation*180/Math.PI});}};}
let checks=0;
for(const preset of api.motifPresets)for(const count of [2,5,9])for(const [width,height] of [[720,400],[400,720],[3987,2813]])for(const natural of [false,true]){
  const settings=api.freshPreset(preset.id);if(natural)settings.reference.cropAspect="natural";
  const images=Array.from({length:count},(_,id)=>({id,width:120+id*35,height:160+id*7}));
  const params={...settings.reference,cropAspectRatio:settings.reference.cropAspect,borderRadius:settings.reference.cornerRadius*10.8};
  for(const p of preset.params)if(typeof params[p.key]==="number")params[p.key]/=api.motifFactor(p.key);
  for(let frame=0;frame<80;frame++){
    const seconds=frame/80*settings.motion.duration,ctx=recorder();oracle[preset.templateId]({ctx,t:seconds/settings.motion.duration,width,height,settings:params,media:images});
    const actual=api.referenceScene(settings,images,width,height,seconds);
    assert.equal(actual.length,ctx.cards.length,`${preset.label}: count`);
    if(preset.templateId==="LoopBoardTemplate"){const order=(a,b)=>a.source-b.source||a.x-b.x||a.y-b.y;actual.sort(order);ctx.cards.sort(order);}
    for(let i=0;i<actual.length;i++)for(const field of ["source","x","y","width","height","radius","rotation","opacity"])assert(Math.abs((actual[i][field]??1)-ctx.cards[i][field])<1e-6,`${preset.label} ${natural} ${count} t=${seconds}: ${field} ${actual[i][field]} vs ${ctx.cards[i][field]}`);
    checks++;
  }
}
console.log(`Motif oracle: ${api.motifPresets.length} presets, ${checks} scene comparisons passed.`);
