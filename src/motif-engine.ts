import type { NativeCard, SourceSize } from "./reference-engine";
import type { MotionSettings } from "./types";
import type { MotifPreset } from "./motif-catalog";
import { motifDefaults, motifFactor } from "./motif-controls";

const tau=Math.PI*2,wrap=(x:number,n=1)=>((x%n)+n)%n;
const spiralCache=new Map<number,Float32Array>();
function spiralLookup(turns:number){
  const cached=spiralCache.get(turns);if(cached)return cached;
  const distances=new Float32Array(2001);let x=1,y=0;
  for(let i=1;i<=2000;i++){const t=i/2000,angle=t*turns*tau,nx=(1-t)*Math.cos(angle),ny=-(1-t)*Math.sin(angle);distances[i]=distances[i-1]+Math.hypot(nx-x,ny-y);x=nx;y=ny;}
  const total=distances[2000]||1,lookup=new Float32Array(1025);let cursor=0;
  for(let i=0;i<=1024;i++){const distance=i/1024*total;while(cursor<2000&&distances[cursor+1]<distance)cursor++;const span=distances[cursor+1]-distances[cursor];lookup[i]=(cursor+(span>0?(distance-distances[cursor])/span:0))/2000;}
  if(spiralCache.size>=8)spiralCache.delete(spiralCache.keys().next().value!);
  spiralCache.set(turns,lookup);return lookup;
}
export function motifScene(settings:MotionSettings,preset:MotifPreset,sources:readonly SourceSize[],width:number,height:number,seconds:number):NativeCard[]{
  const stored={...motifDefaults(preset),...settings.reference},raw={...stored};
  for(const parameter of preset.params)if(typeof raw[parameter.key]==="number")raw[parameter.key]=Number(raw[parameter.key])/motifFactor(parameter.key);
  const n=(key:string)=>Number(raw[key]),s=(key:string)=>String(raw[key]);
  const count=Math.min(sources.length,preset.maxSlots),phaseInput=seconds/settings.motion.duration,phase=phaseInput>=0&&phaseInput<1?phaseInput:wrap(phaseInput),unit=Math.min(width,height)/100;
  const natural=stored.cropAspect==="natural";
  const ratios=sources.slice(0,count).map(source=>source.width/source.height).sort((a,b)=>a-b);
  const median=ratios.length%2?ratios[ratios.length>>1]:(ratios[ratios.length/2-1]+ratios[ratios.length/2])/2;
  const crop=String(stored.cropAspect??preset.defaultCropAspect).split(":").map(Number);
  const aspect=natural?median:crop[0]/crop[1];
  let cardHeight=height*n("scaleIntensity"),cardWidth=cardHeight*aspect;
  if(cardWidth>.92*width){cardWidth=.92*width;cardHeight=cardWidth/aspect;}
  const radius=Number(stored.cornerRadius)*unit;
  const cards:NativeCard[]=[];
  const add=(source:number,layer:number,x:number,y:number,w:number,h:number,rotation:number,tiled=false)=>{
    source=wrap(source,count);
    if(natural&&!tiled){const fit=Math.min(w/sources[source].width,h/sources[source].height);w=sources[source].width*fit;h=sources[source].height*fit;}
    cards.push({source,layer,x,y,width:w,height:h,rotation,radius:Math.min(radius,w/2,h/2),fill:!natural||tiled});
  };
  if(preset.templateId==="LoopSwirlTemplate"){
    // Expand both spiral axes together: spacing between turns and between
    // consecutive cards changes without resizing cards or changing population.
    const gapScale=Math.max(.01,n("spacing")/4);
    const lookup=spiralLookup(n("turns")),outer=.48*unit*100*(1+(n("spread")-1)*.18)*gapScale,total=Math.max(1,Math.min(100,Math.round(n("visibleCount"))));
    const offset=(s("direction")==="outward"?-1:1)*phase*(count/total),baseHeight=Math.min(width,height)*n("scaleIntensity"),baseWidth=Math.min(.92*width,baseHeight*aspect),shortHeight=baseWidth/aspect;
    const position=(t:number)=>({x:outer*(1-t)*Math.cos(t*n("turns")*tau),y:-outer*(1-t)*Math.sin(t*n("turns")*tau)});
    const slots=Array.from({length:total},(_,slot)=>{const progress=wrap(offset+slot/total),sample=Math.max(0,Math.min(1024,1024*progress)),index=Math.floor(sample);return {slot,progress,t:lookup[index]+(lookup[Math.min(index+1,1024)]-lookup[index])*(sample-index)};}).sort((a,b)=>a.t-b.t);
    for(const [layer,card] of slots.entries()){
      const point=position(card.t),distance=Math.hypot(point.x,point.y),pct=100*card.progress,alpha=(n("fadeIn")>0?Math.max(0,Math.min(1,pct/n("fadeIn"))):1)*Math.max(0,Math.min(1,(100-pct)/4));
      if(alpha<.01)continue;
      const scale=n("depthFalloff")>0?Math.pow(Math.min(distance/outer,1),.5*n("depthFalloff")):1,w=baseWidth*scale,h=shortHeight*scale;
      if(w<1||h<1)continue;
      const tangent=position(Math.min(card.t+.001,1));
      add(card.slot,layer,width/2+point.x,height/2+point.y,w,h,Math.atan2(tangent.y-point.y,tangent.x-point.x)*180/Math.PI);
      cards[cards.length-1].radius=Math.min(radius,w/2,h/2)*scale;
      cards[cards.length-1].opacity=alpha;
    }
  }else if(preset.templateId==="LoopRingTemplate"){
    const total=count*Math.max(1,Math.round(n("repeat"))),spin=(s("direction")==="anticlockwise"?-1:1)*wrap(phase)*tau;
    const order=Array.from({length:total},(_,i)=>i);if(s("stack")==="firstOnTop")order.reverse();
    for(const [layer,index] of order.entries()){
      const angle=index/total*tau+spin;
      add(index,layer,width/2+Math.cos(angle)*unit*n("radiusX"),height/2+Math.sin(angle)*unit*n("radiusY"),cardWidth,cardHeight,raw.tangent?(angle+Math.PI/2)*180/Math.PI:0);
    }
  }else if(preset.templateId==="LoopCircleTemplate"){
    const rings=Math.max(1,Math.round(n("rings"))),population=Math.max(rings,Math.round(n("cards"))),radii=Array.from({length:rings},(_,i)=>Math.max(1,unit*(n("innerRadius")+i*n("ringGap"))));
    const circumference=radii.reduce((sum,r)=>sum+tau*r,0),spin=Math.round(n("turns"))*tau*wrap(phase);
    let seed=0x9e3779b1,index=0;
    // Keep the source PRNG's exact sequence (including its intermediate update).
    const next=()=>{seed=(seed+0x6d2b79f5)>>>0;let value=Math.imul(seed^(seed>>>15),1|seed);value=(value+Math.imul(value^(value>>>7),61|value))^value;return ((value^(value>>>14))>>>0)/0x100000000;};
    for(let ring=0;ring<rings;ring++){
      const total=Math.max(2,Math.round(2*population*Math.PI*radii[ring]/circumference));
      const direction=s("direction")==="ccw"?-1:s("direction")==="alternate"?(ring%2===0?1:-1):1;
      for(let slot=0;slot<total;slot++){
        const tilt=(2*next()-1)*n("tilt"),angle=slot/total*tau+.6*ring+direction*spin;
        add(index,index,width/2+Math.cos(angle)*radii[ring],height/2+Math.sin(angle)*radii[ring],cardWidth,cardHeight,tilt);index++;
      }
    }
  }else if(preset.templateId==="LoopSwipeTemplate"){
    const local=wrap(phase)*count,index=Math.floor(local),t=local-index;
    const ease=s("easing")==="linear"?t:s("easing")==="snappy"?(t>=1?1:1-Math.pow(2,-10*t)):s("easing")==="elastic"?(t<=0?0:t>=1?1:Math.pow(2,-10*t)*Math.sin(tau/3*(10*t-.75))+1):t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
    const g=Math.min(width,height)/560,sign=s("direction")==="left"?-1:1,focal=1000*g;
    const positions=Array.from({length:count},(_,slot)=>{const relative=wrap(slot-index,count),destination=relative===0?count-1:relative-1;return {slot,at:relative+(destination-relative)*ease};}).sort((a,b)=>b.at-a.at);
    for(const [layer,card] of positions.entries()){
      const fraction=count>1?card.at/(count-1):0,perspective=focal/(focal+10*card.at*g),scale=Math.max(.05,1-.05*card.at)*perspective;
      add(card.slot,layer,width/2+sign*fraction*n("xOffset")*g*perspective,height/2-card.at*n("stackOffset")*g*perspective,cardWidth*scale,cardHeight*scale,sign*fraction*n("tiltAngle"));
    }
  }else{
    const spacing=unit*n("spacing"),pitchX=cardWidth+spacing,pitchY=cardHeight+spacing,period=Math.max(Math.ceil(Math.max(width/pitchX,height/pitchY))+2,Math.round(n("travel")));
    const directions:Record<string,[number,number]>={"up-left":[-1,-1],up:[0,-1],"up-right":[1,-1],right:[1,0],"down-right":[1,1],down:[0,1],"down-left":[-1,1],left:[-1,0]};
    const [dx,dy]=directions[s("direction")]??directions["down-left"],x=dx*period*pitchX*phase,y=dy*period*pitchY*phase;
    const startX=Math.floor((x-cardWidth)/pitchX),startY=Math.floor((y-cardHeight)/pitchY),columns=Math.ceil((width+2*cardWidth)/pitchX)+2,rows=Math.ceil((height+2*cardHeight)/pitchY)+2;
    for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
      const worldX=startX+col,worldY=startY+row,left=worldX*pitchX-x,top=worldY*pitchY-y;
      if(left>width||top>height||left+cardWidth<0||top+cardHeight<0)continue;
      const cellX=wrap(worldX,period),cellY=wrap(worldY,period);let hash=0x466f45d*cellX^0x127409f*cellY;hash=Math.imul(hash^(hash>>>13),0x4bf19f61);const random=((hash^(hash>>>16))>>>0)/0x100000000;
      // Grid cells do not overlap. Stable cell ownership avoids duplicating a
      // full set of images for every slot as the shuffled grid wraps.
      add(Math.floor(random*count),cellY*period+cellX,left+cardWidth/2,top+cardHeight/2,cardWidth,cardHeight,0,true);
    }
    cards.sort((a,b)=>a.layer-b.layer);
  }
  return cards;
}
