import { pointForGeometry } from "./engine";
import { referenceDefinition } from "./reference-catalog";
import type { MotionSettings } from "./types";
import { motifScene } from "./motif-engine";

export type SourceSize = { width: number; height: number };
export type NativeCard = { source: number; layer: number; x: number; y: number; width: number; height: number; rotation: number; radius: number; fill: boolean; shade?: number; opacity?: number };
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const wrap = (x: number, length = 1) => ((x % length) + length) % length;

// Same cubic inversion and precision as the source renderer; easing applies
// to individual transitions, not a second time to the whole loop.
export function referenceEase(x: number, handles: readonly number[] = [.86,.14,.14,.86]): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const [x1,y1,x2,y2] = handles;
  let t = x;
  for (let i=0;i<12;i++) {
    const value=(1-t)**3*0+3*(1-t)**2*t*x1+3*(1-t)*t**2*x2+t**3;
    const slope=3*(1-t)**2*x1+6*(1-t)*t*(x2-x1)+3*t**2*(1-x2);
    if (Math.abs(slope)<1e-7) break;
    t=clamp(t-(value-x)/slope);
  }
  return (1-t)**3*0+3*(1-t)**2*t*y1+3*(1-t)*t**2*y2+t**3;
}
function inverseEase(y: number, ease: (x:number)=>number) {
  if(y<=0||y>=1)return clamp(y);
  let low=0, high=1;
  for(let i=0;i<25;i++){const mid=(low+high)/2;if(ease(mid)<y)low=mid;else high=mid;}
  return (low+high)/2;
}
function peakSlope(h: readonly number[]) {
  const [x1,y1,x2,y2]=h;let peak=.5, previous=0, varied=false;
  for(let i=1;i<200;i++){
    const t=i/200,u=1-t,dx=3*u*u*x1+6*u*t*(x2-x1)+3*t*t*(1-x2);
    if(dx<1e-6)continue;
    const slope=(3*u*u*y1+6*u*t*(y2-y1)+3*t*t*(1-y2))/dx;
    if(previous>0&&Math.abs(slope-previous)>.01)varied=true;
    if(slope>previous+.01){previous=slope;peak=3*u*u*t*x1+3*u*t*t*x2+t*t*t;}else if(previous===0)previous=slope;
  }
  return varied?Math.max(.05,Math.min(.95,peak)):.5;
}

export function referenceScene(settings: MotionSettings, sizes: readonly SourceSize[], width: number, height: number, seconds: number): NativeCard[] {
  const preset=referenceDefinition(settings);
  if(!preset||!sizes.length||width<=0||height<=0)return [];
  if("params" in preset)return motifScene(settings,preset,sizes,width,height,seconds);
  if(preset.mode==="rfCarousel"&&height!==1080){
    const scale=height/1080;
    return referenceScene(settings,sizes,width/height*1080,1080,seconds).map(card=>({...card,x:card.x*scale,y:card.y*scale,width:card.width*scale,height:card.height*scale,radius:card.radius*scale}));
  }
  const p={...preset.values,...settings.reference} as Record<string,number|string|boolean>;
  const number=(key:string,fallback:number)=>typeof p[key]==="number"?p[key] as number:fallback;
  const str=(key:string,fallback:string)=>typeof p[key]==="string"?p[key] as string:fallback;
  const count=Math.min(sizes.length,preset.maxSlots);
  const phaseInput=seconds/Math.max(.01,settings.motion.duration);
  const phase=phaseInput>=0&&phaseInput<1?phaseInput:wrap(phaseInput);
  const handles=[number("easeX1",.86),number("easeY1",.14),number("easeX2",.14),number("easeY2",.86)];
  const ease=(x:number)=>referenceEase(x,handles);
  const cycles=number("cycles",1);
  const cards: NativeCard[]=[];
  const radius=number("cornerRadius",0)*height/100;
  const add=(source:number,layer:number,x:number,y:number,w:number,h:number,rotation=0,corner=radius,fill=false)=>cards.push({source:wrap(source,count),layer,x,y,width:w,height:h,rotation,radius:Math.min(corner,w/2,h/2),fill});
  if(preset.mode==="rfCarousel"){
    const direction=str("direction","up"),vertical=direction==="up"||direction==="down",sign=direction==="up"||direction==="left"?-1:1;
    const stagger=number("stagger",1/15),delay=number("delay",0),duration=Math.max(0,number("duration",1.67));
    const period=cycles>0?duration+count*stagger+delay:0;
    const seconds=phase*Math.round((duration+count*stagger+delay+stagger)*cycles*count*1e5)/1e5;
    const visibleLimit=Math.max(1,Math.min(20,Math.round(number("visible",count))));
    // Visible cards controls the camera scale as well as the population cap.
    // Keep card-size and gap independently editable around the reference size.
    const rowZoom=(vertical?height:width)/(visibleLimit*600);
    const plane=Math.round(number("planeSize",600/1080*100)*10.8*1e10)/1e10*rowZoom,gap=Math.round(number("gap",40/1080*100)*10.8*1e10)/1e10*rowZoom,pitch=plane+gap;
    const overlap=gap<height/1080*.5?height/1080:0;
    const offsetX=number("offsetX",0)*width/100,offsetY=number("offsetY",0)*height/100;
    const solo=p.solo===true,depthFade=clamp(number("depthFade",0)/100),extent=vertical?height:width;
    const amount=number("tilt",0)/100,tiltStyle=str("tiltStyle","off");
    const visible=pitch>0?Math.max(1,Math.min(count,Math.round(extent/pitch))):count,start=solo?0:-sign*Math.floor(visible/2);
    const scales=str("scaleCenter","off")==="on",centerScale=scales?Math.max(1,number("centerScale",1)):1,focus=str("scaleFocus","right");
    // The size gradient follows the visible population, not the number of
    // source layers (which may be repeated to fill the Row).
    const edge=scales&&focus!=="center",focusSign=focus==="start"||focus==="left"?-1:1,span=Math.max(pitch,(visibleLimit-1)/2*pitch);
    const bias=edge?Math.max(-.9,Math.min(.9,plane*(centerScale-1)*focusSign/Math.max(1,pitch))):0;
    const bend=(x:number)=>Math.abs(x)<=span?x*x/(2*span):Math.abs(x)-span/2;
    const prepared:Array<{source:number;x:number;y:number;width:number;distance:number;rotation:number;shade:number}>=[];
    for(let item=0;item<count;item++){
      const source=sign>0?wrap(count-item,count):item,aspect=sizes[source].width/sizes[source].height;
      const cardWidth=vertical?plane*aspect:plane,cardHeight=vertical?plane:plane/aspect;
      const bound=(vertical?height/2+cardHeight:width/2+cardWidth)+Math.abs(vertical?offsetY:offsetX);
      const repeat=pitch*count>0?Math.ceil(bound/(pitch*count))+1:1;
      for(let copy=-repeat;copy<=repeat;copy++){
        const absolute=item+copy*count,delayIndex=sign<0?absolute:count-1-absolute;
        let progress=0;
        if(period>0){const shifted=seconds-delayIndex*stagger,whole=Math.floor(shifted/period),local=shifted-whole*period;progress=whole+ease(clamp(duration>0?local/duration:1));}
        const position=(absolute+sign*progress-start)*pitch;
        const scale=edge?Math.max(.1,1+(centerScale-1)*Math.max(-1,Math.min(1,focusSign*position/span))):1+(centerScale-1)*(scales&&span>0?Math.max(0,1-Math.abs(position)/span):0);
        const location=bias!==0?position+bias*bend(position):position,normalized=Math.max(-1,Math.min(1,location/Math.max(1,extent/2)));
        const angle=tiltStyle==="off"?0:1.0471975512*amount*(tiltStyle==="uniform"?Math.abs(normalized):tiltStyle==="alternate"?normalized*(source%2===0?1:-1):normalized)*180/Math.PI;
        if(!solo&&(location>bound||location<-bound))continue;
        prepared.push({source,x:width/2+(vertical?0:location)+offsetX,y:height/2+(vertical?location:0)+offsetY,width:cardWidth*scale,distance:Math.abs(location),rotation:angle,shade:solo?0:Math.min(ease(clamp(Math.abs(location)/(extent/2))),1)*depthFade});
      }
    }
    if(scales&&focus==="center"&&!solo&&prepared.length){
      // Pack scaled edges, not equally spaced centers. Anchor the two cards
      // straddling the focus by their travel phase to avoid a jump when the
      // nearest card changes during playback.
      const axis=vertical?"y":"x",origin=(vertical?height:width)/2+(vertical?offsetY:offsetX);
      prepared.sort((a,b)=>a[axis]-b[axis]);
      const positions=prepared.map(card=>card[axis]-origin);
      const extentOf=(card:typeof prepared[number])=>vertical?card.width/(sizes[card.source].width/sizes[card.source].height):card.width;
      const packed=[0];
      for(let i=1;i<prepared.length;i++)packed.push(packed[i-1]+(extentOf(prepared[i-1])+extentOf(prepared[i]))/2+gap);
      let right=positions.findIndex(position=>position>=0);
      if(right<0)right=positions.length-1;
      const left=Math.max(0,right-1),travel=positions[right]-positions[left];
      const anchor=travel>0?packed[left]+(packed[right]-packed[left])*(-positions[left]/travel):packed[right]-positions[right];
      for(let i=0;i<prepared.length;i++){
        const location=packed[i]-anchor,card=prepared[i];
        card[axis]=origin+location;card.distance=Math.abs(location);
        card.shade=ease(clamp(card.distance/(extent/2)))*depthFade;
      }
    }
    const byDistance=(a:typeof prepared[number],b:typeof prepared[number])=>Math.abs(a.distance-b.distance)>1e-7?a.distance-b.distance:(vertical?a.y-b.y:a.x-b.x);
    if(solo)prepared.sort(byDistance).splice(1);
    else {
      if(prepared.length>visibleLimit){
        const nearest=[...prepared].sort(byDistance).slice(0,visibleLimit);
        prepared.splice(0,prepared.length,...nearest);
      }
      prepared.sort((a,b)=>byDistance(b,a));
    }
    for(const [layer,card] of prepared.entries()){
      if(card.width<.5*height/1080)continue;
      let x=card.x,y=card.y;
      if(str("pathShape","line")!=="line"){
        // Change only the route: Row still owns progress, pauses, stagger,
        // packing, focus scaling and the visible population.
        const location=vertical?card.y-height/2-offsetY:card.x-width/2-offsetX;
        const angle=location/Math.max(1,extent)*Math.PI*2;
        const pathSettings={...settings,motion:{...settings.motion,radiusPulse:0,scalePulse:0,opacityPulse:0,depthPulse:0},
          geometry:{...settings.geometry,shape:str("pathShape","ellipse") as MotionSettings["geometry"]["shape"],orient3d:false,circleRotation:0}};
        const point=pointForGeometry(angle,pathSettings,card.source,count);
        const rotation=(settings.geometry.circleRotation??0)*Math.PI/180;
        x=width/2+(point.x*Math.cos(rotation)-point.y*Math.sin(rotation))*width/100+offsetX;
        y=height/2+(point.x*Math.sin(rotation)+point.y*Math.cos(rotation))*height/100+offsetY;
      }
      add(card.source,layer,x,y,card.width+overlap,card.width/(sizes[card.source].width/sizes[card.source].height)+overlap,solo?0:card.rotation);
      if(scales&&focus==="center")cards[cards.length-1].opacity=1-card.shade;
      else cards[cards.length-1].shade=card.shade>.01?card.shade:0;
    }
  }else if(preset.mode==="rfStack"){
    const duration=Math.max(0,number("duration",1.33)),step=duration+Math.max(0,number("delay",.67));
    if(step<=0)return [];
    const t=wrap(phase*Math.round(step*count*cycles*1e5)/1e5,step*count),index=Math.floor(t/step),local=t-index*step;
    const visible=Math.max(2,Math.min(8,number("visible",4)|0)),stagger=Math.max(0,number("stagger",1/30));
    const zoom=Math.max(.1,number("zoom",100)/100),size=Math.max(.01,Math.min(2,number("planeSize",60)/100))*zoom;
    const perspective=Math.max(0,Math.min(2,number("perspective",50)/50));
    const offsetX=number("offsetX",0)*width/100,offsetY=number("offsetY",0)*height/100;
    const mid=(.43+.544)*height/2,half=(.544-.43)*height/2*zoom;
    const back=mid-half+offsetY,front=mid+half+offsetY,pitch=(front-back)/(visible-1);
    const frontSize=size*height,backSize=frontSize*Math.max(.05,1-.158*perspective);
    const sizePower=Math.max(.05,1-.15*perspective),positionPower=Math.max(.1,1-.075*perspective);
    const tailPitch=Math.max(0,1-.84*perspective),tailScale=Math.max(.05,1-.147*perspective);
    for(let slot=-1;slot<=visible;slot++){
      const source=wrap(index+visible-1-slot,count),elapsed=local-(visible-1-slot)*stagger;
      const position=slot+ease(duration>0?clamp(elapsed/duration):1);
      if(position<-.5||position>visible-.5)continue;
      const k=position/(visible-1);
      let y=position<0?back+position*pitch*tailPitch:k>1?front+(front-back)*positionPower*(k-1):back+(front-back)*Math.pow(k,positionPower);
      if(str("direction","down")==="up")y=height-y+2*offsetY;
      const h=position<0?backSize*(1+position*(1-tailScale)):k>1?frontSize+(frontSize-backSize)*sizePower*(k-1):backSize+(frontSize-backSize)*Math.pow(k,sizePower);
      add(source,slot+1,width/2+offsetX,y,h*sizes[source].width/sizes[source].height,h);
    }
  }else if(preset.mode==="rfFlicker"){
    const duration=Math.max(.1,number("duration",6)),step=duration/count,hold=Math.min(.95*step,Math.max(0,number("delay",0)));
    const phaseInCycle=wrap(phase*Math.round(duration*cycles*1e5)/1e5/duration);
    let source:number,local:number,start:number,end:number,split:number,middle:number,interpolate:(x:number)=>number;
    if(str("pacing","equal")==="eased"){
      const times=Array.from({length:count+1},(_,i)=>inverseEase(i/count,ease));
      source=count-1;for(let i=0;i<count;i++)if(phaseInCycle<times[i+1]){source=i;break;}
      local=clamp((phaseInCycle-times[source])/Math.max(1e-4,times[source+1]-times[source]));
      interpolate=x=>x*x*(3-2*x);split=.5;middle=.5;const pause=Math.min(.95,hold/step);start=(1-pause)/2;end=start+pause;
    }else{
      const item=phaseInCycle*count;source=Math.min(count-1,Math.floor(item));local=item-source;
      interpolate=ease;split=peakSlope(handles);middle=ease(split);start=(1-split)*(step-hold)/step;end=start+hold/step;
    }
    let motion=local<start?.5*clamp((interpolate(split+(1-split)*(start>0?local/start:0))-middle)/Math.max(.001,1-middle)):local<end?.5:.5+.5*clamp(interpolate((local-end)/Math.max(.001,1-end)*split)/Math.max(.001,middle));
    const scaleAmount=Math.max(0,number("scaleAmount",30))/100,drift=Math.max(0,number("driftAmount",30))/100;
    let scale=1,dx=0,dy=0;
    if(str("effect","off")==="scale")scale=1+(str("scaleDir","forward")==="forward"?1:-1)*(motion-.5)*scaleAmount;
    if(str("effect","off")==="drift"){
      const distance=(motion-.5)*drift,direction=str("driftDir","up");
      if(direction==="left")dx=-distance;else if(direction==="right")dx=distance;else dy=direction==="up"?-distance:distance;
    }
    const fit=Math.max(width/sizes[source].width,height/sizes[source].height)*Math.max(.01,number("planeSize",100)/100)*scale;
    add(source,0,width*(.5+number("offsetX",0)/100+dx),height*(.5+number("offsetY",0)/100+dy),sizes[source].width*fit,sizes[source].height*fit);
  }else{
    const duration=Math.max(.05,number("duration",2)),stagger=Math.max(.02,number("stagger",.4));
    const span=Math.min(duration,Math.max(1,count-1)*stagger),size=Math.max(.05,Math.min(1,number("planeSize",100)/100));
    const t=wrap(phase*Math.round(count*stagger*cycles*1e5)/1e5,stagger*count)/stagger;
    const current=Math.floor(t),visible=Math.min(count,Math.ceil(span/stagger)+2),recede=str("scaleStyle","bloom")==="recede";
    const prepared=[];
    for(let offset=0;offset<visible;offset++){
      const birth=current-offset,age=(t-birth)*stagger,progress=clamp(age/span),fraction=(recede?ease(1-progress):ease(progress))*size;
      if(fraction<=.0008)continue;
      prepared.push({source:wrap(birth,count),age,fraction,rotation:number("spin",0)*(1-Math.min(1,fraction/size))});
    }
    prepared.sort((a,b)=>b.fraction-a.fraction||b.age-a.age);
    const origin=str("growFrom","center"),ax=origin==="left"?0:origin==="right"?1:.5,ay=origin==="top"?0:origin==="bottom"?1:.5;
    prepared.forEach((card,layer)=>{
      const source=sizes[card.source],fill=str("imageFit","fit")==="fill";
      const fit=Math.min(width/source.width,height/source.height)*card.fraction;
      const w=fill?width*card.fraction:source.width*fit,h=fill?height*card.fraction:source.height*fit;
      add(card.source,layer,ax*width+(.5-ax)*w,ay*height+(.5-ay)*h,w,h,card.rotation,radius*card.fraction,fill);
    });
  }
  return cards;
}
