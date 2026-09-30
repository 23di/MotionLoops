// Render the same scene/keyframe functions used by the plugin preview.
// Requires Python + Pillow and ffmpeg. No browser or Figma recording involved.
import {build} from 'esbuild';
import {writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const bundle=await build({stdin:{contents:`export {freshPreset} from './src/catalog';export {referenceDefinition,activeReferencePresets} from './src/reference-catalog';export {referenceScene} from './src/reference-engine';export {fitSettingsToFrame,generateNodeKeyframes,sampleGeneratedKeyframes} from './src/engine';`,resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm'});
const engine=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const chapters=[{id:'orbit-3d-compact',label:'Orbit 04'},{id:'reference-carousel-07',label:'Row 02'},{id:'reference-stack-01',label:'Stack 01'},{id:'reference-spiralimages',label:'Vortex'}];
// Resolve the public Vortex entry rather than relying on a guessed legacy ID.
chapters[3].id=engine.activeReferencePresets.find(p=>p.label==='Vortex 01')?.id??engine.activeReferencePresets.find(p=>p.label.startsWith('Vortex'))?.id;
if(!chapters[3].id)throw new Error('Vortex preset unavailable');
const fps=30,secondsPerChapter=6,width=960,height=650;
const sizes=Array.from({length:6},()=>({width:170,height:220}));
const linear={type:'easing',duration:1,ease:[0,0,1,1]};
const frames=[];
for(const [chapter,definition] of chapters.entries()){
  const settings=engine.freshPreset(definition.id);
  const native=engine.referenceDefinition(settings);
  const generated=native?null:sizes.map((s,i)=>engine.generateNodeKeyframes(engine.fitSettingsToFrame(settings,width,height,s.width,s.height,sizes.length),i,sizes.length));
  for(let frame=0;frame<fps*secondsPerChapter;frame++){
    const time=frame/(fps*secondsPerChapter)*settings.motion.duration;
    const cards=native?engine.referenceScene(settings,sizes,width,height,time):generated.map((keys,i)=>{
      const p=engine.sampleGeneratedKeyframes(keys,time,linear);
      return {source:i,layer:p.stackOrder??p.z,x:width/2+p.x,y:height/2+p.y,width:sizes[i].width*p.scaleX,height:sizes[i].height*p.scaleY,rotation:p.rotation,radius:12,opacity:p.opacity};
    }).sort((a,b)=>a.layer-b.layer);
    frames.push({chapter,progress:frame/(fps*secondsPerChapter),cards});
  }
}
const work=mkdtempSync(join(tmpdir(),'motion-loops-demo-'));
const output=resolve(process.argv[2]??'docs/demo');
try{
 writeFileSync(join(work,'scenes.json'),JSON.stringify({fps,width,height,chapters,frames}));
 const result=spawnSync('python3',['scripts/render-reddit-demo.py',join(work,'scenes.json'),output],{stdio:'inherit'});
 if(result.status!==0)throw new Error('Demo rendering failed');
}finally{rmSync(work,{recursive:true,force:true});}
