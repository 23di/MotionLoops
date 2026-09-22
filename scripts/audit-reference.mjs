// Read-only numerical comparison against the source Canvas painter. The source
// is not executed as an app: only isolated numeric branches run against
// a recording context, without document/window/network access. Row has its own
// camera scaling, repeat, and visible-card behavior, covered by reference tests.
import ts from "typescript";
import { build } from "esbuild";
import assert from "node:assert/strict";
const bundle=await build({entryPoints:["src/reference-engine.ts","src/catalog.ts"],bundle:true,write:false,format:"esm",platform:"node",outdir:"unused"});
const engine=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
const catalog=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[1].text).toString("base64")}`);
const dataBundle=await build({entryPoints:["src/reference-catalog.ts"],bundle:true,write:false,format:"esm",platform:"node"});
const {referencePresets}=await import(`data:text/javascript;base64,${Buffer.from(dataBundle.outputFiles[0].text).toString("base64")}`);
const url="https://reelfolio.io/_next/static/chunks/295e-nd46k946.js";
const response=await fetch(url);assert(response.ok,`Source unavailable: ${response.status}`);
const source=await response.text(),ast=ts.createSourceFile("source.js",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
let painter,cubic;
function visit(node){if(ts.isFunctionDeclaration(node)&&node.name?.text==="eI")painter=node;if(ts.isFunctionDeclaration(node)&&node.name?.text==="q"&&node.getText(ast).includes("t.sy"))cubic=node;ts.forEachChild(node,visit);}
visit(ast);assert(painter&&cubic,"Source painter structure changed; re-audit before updating.");
const branches=painter.body.statements.filter(node=>ts.isIfStatement(node)&&/\"rf(?:Carousel|Stack|Flicker|Scale)\"===eN/.test(node.expression.getText(ast)));
assert.equal(branches.length,4);
const peak=painter.body.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==="eF");
const oracle=new Function("e","ev","eb","i","eN","eS","images","eL",`
  const a={images},ez=images,eO=images.length,eB={[eN]:eS.solo},eE={[eN]:eS.depthFade},eP=eN,eA={hex:'#000'},eC=ev/2,ej=eb/2;
  const K=x=>x,el=x=>x.width,ec=x=>x.height,es=()=>{},ew=()=>{};
  ${cubic.getText(ast)} const ek=x=>q(x,eL);
  ${peak.getText(ast)} ${branches.map(node=>node.getText(ast)).join("\n")}
`);
function record(){
  let state={x:0,y:0,rotation:0,radius:0},stack=[],cards=[];
  return {cards,save(){stack.push({...state})},restore(){state=stack.pop()},translate(x,y){state.x+=x;state.y+=y},rotate(r){state.rotation+=r},beginPath(){},roundRect(x,y,w,h,r){state.radius=r},clip(){},fill(){},fillRect(){},drawImage(image,...args){const [x,y,w,h]=args.slice(-4),cx=x+w/2,cy=y+h/2,c=Math.cos(state.rotation),s=Math.sin(state.rotation);cards.push({source:image.id,x:state.x+cx*c-cy*s,y:state.y+cx*s+cy*c,width:w,height:h,rotation:state.rotation*180/Math.PI,radius:state.radius})}};
}
let checks=0;
const oraclePresets=referencePresets.filter(p=>p.mode!=="motif"&&p.mode!=="rfCarousel");
for(const preset of oraclePresets)for(const count of [2,5,9])for(const [width,height] of [[720,400],[400,720],[3987,2813]]){
  const settings=catalog.freshPreset(preset.id),images=Array.from({length:count},(_,id)=>({id,width:120+id*35,height:160+id*7}));
  const params={...settings.reference,count,cornerRadius:0};
  if(preset.mode==="rfCarousel")for(const key of ["planeSize","gap"])params[key]=Math.round(params[key]*10.8*1e10)/1e10;
  const rawDuration=preset.mode==="rfCarousel"?(params.duration+count*params.stagger+params.delay+params.stagger)*params.cycles*count:preset.mode==="rfStack"?(params.duration+params.delay)*count*(params.cycles??1):preset.mode==="rfScale"?count*params.stagger*(params.cycles??1):params.duration*(params.cycles??1);
  for(let frame=0;frame<160;frame++){
    const seconds=frame/160*settings.motion.duration,phase=seconds/settings.motion.duration,ctx=record();oracle(ctx,width/height*1080,1080,phase*Math.round(rawDuration*1e5)/1e5,preset.mode,params,images,{sx:0,sy:0,ex:1,ey:1,h1x:.86,h1y:.14,h2x:.14,h2y:.86});
    for(const card of ctx.cards)for(const key of ["x","y","width","height","radius"])card[key]*=height/1080;
    const actual=engine.referenceScene(settings,images,width,height,seconds);
    assert.equal(actual.length,ctx.cards.length,`${preset.label} count at ${phase}`);
    for(let i=0;i<actual.length;i++)for(const key of ["source","x","y","width","height","rotation","radius"]){const error=Math.abs(actual[i][key]-ctx.cards[i][key]);assert(error<1e-6,`${preset.label} ${count} ${width}×${height} phase ${phase} card ${i} ${key}: ${actual[i][key]} vs ${ctx.cards[i][key]}`);}
    checks++;
  }
}
console.log(`Reference oracle: ${oraclePresets.length} presets, ${checks} scene comparisons passed.`);
