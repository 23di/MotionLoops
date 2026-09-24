import type { MotionSettings } from "./types";

export function adaptiveCardScale(width:number,height:number,enabled:boolean):number {
  if(!enabled)return 1;
  return Math.min(1,2*Math.min(width,height)/Math.max(width,height,1));
}

/** Resolve the card's base size once, independently of the animation renderer. */
export function cardBaseSize(
  settings: MotionSettings,
  frameWidth: number,
  frameHeight: number,
  sourceWidth: number,
  sourceHeight: number,
): {width:number;height:number;scale:number} {
  const explicit=settings.appearance.cardSize??0;
  let scale=1;
  if(settings.appearance.sizeBasis!=="row"&&explicit>0){
    scale=frameHeight*explicit/100/sourceHeight;
  }else if(settings.appearance.sizeBasis==="row"&&typeof settings.reference?.planeSize==="number"){
    const planeSize=settings.reference.planeSize;
    const direction=settings.reference?.direction;
    const vertical=direction==="up"||direction==="down";
    const visible=Math.max(1,Math.min(20,Math.round(Number(settings.reference?.visible??6))));
    const plane=Math.round(planeSize*10.8*1e10)/1e10*
      (vertical?frameHeight:frameWidth)/(visible*600);
    scale=plane/(vertical?sourceHeight:sourceWidth);
  }
  // Keep unusual aspect ratios legible without altering ordinary preset cards.
  // Card Size still controls the base scale; this bounds either long side.
  scale*=adaptiveCardScale(sourceWidth,sourceHeight,settings.appearance.adaptiveSize!==false);
  return {width:sourceWidth*scale,height:sourceHeight*scale,scale};
}

/** The same physical gap is used by stepped and continuous animations. */
export function cardGapPx(
  settings: MotionSettings,
  frameWidth: number,
  frameHeight: number,
  reference: Record<string,number|string|boolean> = settings.reference??{},
): number {
  const gap=Number(reference.gap??0);
  const visible=Math.max(1,Math.min(20,Math.round(Number(reference.visible??6))));
  const vertical=reference.direction==="up"||reference.direction==="down";
  return Math.round(gap*10.8*1e10)/1e10*(vertical?frameHeight:frameWidth)/(visible*600);
}
