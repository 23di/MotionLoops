// Parameter snapshots supplied in reelfolio-loop-presets.json (2026-09-12).
// Only entries with an implemented native renderer belong in this registry.
import { motifPresets } from "./motif-catalog";
import { recipeKey, recipePresentation, retiredGalleryPresets, rowGalleryGroups } from "./preset-presentation";
import type { MotionSettings } from "./types";

// A model's starting primitives are data; individual presets only tune values.
export const referenceModelCompositions:Record<string,{
  motion?:Partial<MotionSettings["motion"]>;
  geometry?:Partial<MotionSettings["geometry"]>;
  appearance?:Partial<MotionSettings["appearance"]>;
}>={
  rfCarousel:{motion:{queue:true},geometry:{shape:"line"},appearance:{cardSize:0,sizeBasis:"row",nearScale:1,farScale:1,farOpacity:1}},
  rfStack:{motion:{queue:true},geometry:{shape:"line",circleRotation:90}},
};
const seriesPresets = [
  {
    "id": "reference-carousel-01",
    "label": "Carousel 01",
    "mode": "rfCarousel",
    "duration": 18,
    "minSlots": 2,
    "maxSlots": 20,
    "values": {
      "gap": 40,
      "delay": 0,
      "cycles": 1,
      "offsetX": 0,
      "offsetY": 0,
      "stagger": 0.06666666666666667,
      "duration": 1.6,
      "direction": "up",
      "planeSize": 600,
      "centerScale": 1.4,
      "scaleCenter": "off",
      "cornerRadius": 0,
      "scaleFocus": "center",
      "tiltStyle": "off",
      "tilt": 0
    }
  },
  {
    "id": "reference-carousel-02",
    "label": "Carousel 02",
    "mode": "rfCarousel",
    "duration": 18,
    "minSlots": 2,
    "maxSlots": 20,
    "values": {
      "gap": 40,
      "delay": 0,
      "cycles": 1,
      "offsetX": 0,
      "offsetY": 0,
      "stagger": 0.06666666666666667,
      "duration": 1.6,
      "direction": "left",
      "planeSize": 546,
      "centerScale": 1.4,
      "scaleCenter": "off",
      "cornerRadius": 0,
      "scaleFocus": "center",
      "tiltStyle": "off",
      "tilt": 0
    }
  },
  {
    "id": "reference-carousel-03",
    "label": "Carousel 03",
    "mode": "rfCarousel",
    "duration": 18,
    "minSlots": 2,
    "maxSlots": 20,
    "values": {
      "gap": 235,
      "delay": 0,
      "cycles": 1,
      "offsetX": 0,
      "offsetY": 0,
      "stagger": 0.06666666666666667,
      "duration": 1.6,
      "direction": "up",
      "planeSize": 568,
      "centerScale": 1.4500000000000002,
      "scaleCenter": "on",
      "cornerRadius": 0,
      "scaleFocus": "center",
      "tiltStyle": "off",
      "tilt": 0,
      "depthFade": 40
    }
  },
  {
    "id": "reference-carousel-04",
    "label": "Carousel 04",
    "mode": "rfCarousel",
    "duration": 18,
    "minSlots": 2,
    "maxSlots": 20,
    "values": {
      "gap": 190,
      "delay": 0,
      "cycles": 1,
      "offsetX": 0,
      "offsetY": 0,
      "stagger": 0.06666666666666667,
      "duration": 1.6,
      "direction": "left",
      "planeSize": 440,
      "centerScale": 1.4500000000000002,
      "scaleCenter": "on",
      "cornerRadius": 0,
      "scaleFocus": "center",
      "tiltStyle": "off",
      "tilt": 0,
      "depthFade": 40
    }
  },
  {
    "id": "reference-carousel-05",
    "label": "Carousel 05",
    "mode": "rfCarousel",
    "duration": 18,
    "minSlots": 2,
    "maxSlots": 20,
    "productSettings": {"scaleCenter":"on","scaleFocus":"center","centerScale":1.6,"depthFade":25},
    "values": {
      "gap": 80,
      "delay": 0,
      "cycles": 1,
      "offsetX": 0,
      "offsetY": 0,
      "stagger": 0,
      "duration": 2.3,
      "direction": "up",
      "planeSize": 730,
      "centerScale": 1.4,
      "scaleCenter": "off",
      "cornerRadius": 0,
      "scaleFocus": "center",
      "tiltStyle": "off",
      "tilt": 0
    }
  },
  {
    "id": "reference-carousel-06",
    "label": "Carousel 06",
    "mode": "rfCarousel",
    "duration": 18,
    "minSlots": 2,
    "maxSlots": 20,
    "productSettings": {"scaleCenter":"on","scaleFocus":"center","centerScale":1.6,"depthFade":25},
    "values": {
      "gap": 80,
      "delay": 0,
      "cycles": 1,
      "offsetX": 0,
      "offsetY": 0,
      "stagger": 0,
      "duration": 2.3,
      "direction": "left",
      "planeSize": 540,
      "centerScale": 1.4,
      "scaleCenter": "off",
      "cornerRadius": 0,
      "scaleFocus": "center",
      "tiltStyle": "off",
      "tilt": 0
    }
  },
  {
    "id": "reference-carousel-07",
    "label": "Carousel 07",
    "mode": "rfCarousel",
    "duration": 18,
    "minSlots": 2,
    "maxSlots": 20,
    "values": {
      "gap": 500,
      "delay": 0,
      "cycles": 1,
      "offsetX": 0,
      "offsetY": 0,
      "stagger": 0.06666666666666667,
      "duration": 1.6,
      "direction": "up",
      "planeSize": 850,
      "centerScale": 1.4,
      "scaleCenter": "off",
      "cornerRadius": 0,
      "scaleFocus": "center",
      "tiltStyle": "off",
      "tilt": 0
    }
  },
  {
    "id": "reference-carousel-08",
    "label": "Carousel 08",
    "mode": "rfCarousel",
    "duration": 18,
    "minSlots": 2,
    "maxSlots": 20,
    "values": {
      "gap": 500,
      "delay": 0,
      "cycles": 1,
      "offsetX": 0,
      "offsetY": 0,
      "stagger": 0.06666666666666667,
      "duration": 1.6,
      "direction": "left",
      "planeSize": 642,
      "centerScale": 1.4,
      "scaleCenter": "off",
      "cornerRadius": 0,
      "scaleFocus": "center",
      "tiltStyle": "off",
      "tilt": 0
    }
  },
  {
    "id": "reference-carousel-09",
    "label": "Carousel 09",
    "mode": "rfCarousel",
    "duration": 16,
    "minSlots": 2,
    "maxSlots": 20,
    "values": {
      "gap": 332,
      "delay": 0.5,
      "cycles": 1,
      "offsetX": 0,
      "offsetY": 0,
      "stagger": 0,
      "duration": 1.5,
      "direction": "up",
      "planeSize": 600,
      "centerScale": 1.4,
      "scaleCenter": "on",
      "cornerRadius": 0,
      "scaleFocus": "center",
      "tiltStyle": "off",
      "tilt": 0,
      "solo": true
    }
  },
  {
    "id": "reference-carousel-10",
    "label": "Carousel 10",
    "mode": "rfCarousel",
    "duration": 16,
    "minSlots": 2,
    "maxSlots": 20,
    "values": {
      "gap": 332,
      "delay": 0.5,
      "cycles": 1,
      "offsetX": 0,
      "offsetY": 0,
      "stagger": 0,
      "duration": 1.5,
      "direction": "left",
      "planeSize": 454,
      "centerScale": 1.4,
      "scaleCenter": "on",
      "cornerRadius": 0,
      "scaleFocus": "center",
      "tiltStyle": "off",
      "tilt": 0,
      "solo": true
    }
  },
  {
    "id": "reference-carousel-11",
    "label": "Carousel 11",
    "mode": "rfCarousel",
    "duration": 18,
    "minSlots": 2,
    "maxSlots": 20,
    "values": {
      "gap": 235,
      "delay": 0,
      "cycles": 1,
      "offsetX": 0,
      "offsetY": 0,
      "stagger": 0.06666666666666667,
      "duration": 1.6,
      "direction": "up",
      "planeSize": 568,
      "scaleFocus": "start",
      "centerScale": 1.65,
      "scaleCenter": "on",
      "cornerRadius": 0,
      "tiltStyle": "off",
      "tilt": 0
    }
  },
  {
    "id": "reference-carousel-12",
    "label": "Carousel 12",
    "mode": "rfCarousel",
    "duration": 18,
    "minSlots": 2,
    "maxSlots": 20,
    "values": {
      "gap": 140,
      "delay": 0,
      "cycles": 1,
      "offsetX": 0,
      "offsetY": 0,
      "stagger": 0.06666666666666667,
      "duration": 1.6,
      "direction": "left",
      "planeSize": 466,
      "scaleFocus": "start",
      "centerScale": 1.75,
      "scaleCenter": "on",
      "cornerRadius": 0,
      "tiltStyle": "off",
      "tilt": 0
    }
  },
  {
    "id": "reference-carousel-13",
    "label": "Carousel 13",
    "mode": "rfCarousel",
    "duration": 18,
    "minSlots": 2,
    "maxSlots": 20,
    "values": {
      "gap": 500,
      "delay": 0,
      "cycles": 1,
      "offsetX": 0,
      "offsetY": 0,
      "stagger": 0.06666666666666667,
      "duration": 1.6,
      "direction": "down",
      "planeSize": 850,
      "scaleFocus": "end",
      "centerScale": 2,
      "scaleCenter": "on",
      "cornerRadius": 0,
      "tiltStyle": "off",
      "tilt": 0
    }
  },
  {
    "id": "reference-carousel-14",
    "label": "Carousel 14",
    "mode": "rfCarousel",
    "duration": 18,
    "minSlots": 2,
    "maxSlots": 20,
    "values": {
      "gap": 500,
      "delay": 0,
      "cycles": 1,
      "offsetX": 0,
      "offsetY": 0,
      "stagger": 0.06666666666666667,
      "duration": 1.6,
      "direction": "right",
      "planeSize": 639,
      "scaleFocus": "end",
      "centerScale": 2,
      "scaleCenter": "on",
      "cornerRadius": 0,
      "tiltStyle": "off",
      "tilt": 0
    }
  },
  {
    "id": "reference-carousel-15",
    "label": "Carousel 15",
    "mode": "rfCarousel",
    "duration": 13,
    "minSlots": 2,
    "maxSlots": 20,
    "values": {
      "gap": 0,
      "delay": 0,
      "cycles": 1,
      "offsetX": 0,
      "offsetY": 0,
      "stagger": 0,
      "duration": 1.6,
      "direction": "up",
      "planeSize": 614,
      "scaleFocus": "start",
      "centerScale": 1.8,
      "scaleCenter": "on",
      "cornerRadius": 0,
      "tiltStyle": "off",
      "tilt": 0
    }
  },
  {
    "id": "reference-carousel-16",
    "label": "Carousel 16",
    "mode": "rfCarousel",
    "duration": 13,
    "minSlots": 2,
    "maxSlots": 20,
    "values": {
      "gap": 0,
      "delay": 0,
      "cycles": 1,
      "offsetX": 0,
      "offsetY": 0,
      "stagger": 0,
      "duration": 1.6,
      "direction": "left",
      "planeSize": 473,
      "scaleFocus": "start",
      "centerScale": 1.8,
      "scaleCenter": "on",
      "cornerRadius": 0,
      "tiltStyle": "off",
      "tilt": 0
    }
  },
  {
    "id": "reference-carousel-17",
    "label": "Carousel 17",
    "mode": "rfCarousel",
    "duration": 13,
    "minSlots": 2,
    "maxSlots": 20,
    "values": {
      "arc": 0,
      "gap": 273,
      "tilt": -25,
      "delay": 0,
      "cycles": 1,
      "offsetX": 0,
      "offsetY": 0,
      "stagger": 0,
      "duration": 1.6,
      "direction": "up",
      "planeSize": 748,
      "tiltStyle": "alternate",
      "scaleFocus": "center",
      "centerScale": 1.4,
      "scaleCenter": "off",
      "cornerRadius": 0
    }
  },
  {
    "id": "reference-carousel-18",
    "label": "Carousel 18",
    "mode": "rfCarousel",
    "duration": 13,
    "minSlots": 2,
    "maxSlots": 20,
    "values": {
      "arc": 0,
      "gap": 273,
      "tilt": -25,
      "delay": 0,
      "cycles": 1,
      "offsetX": 0,
      "offsetY": 0,
      "stagger": 0,
      "duration": 1.6,
      "direction": "left",
      "planeSize": 657,
      "tiltStyle": "alternate",
      "scaleFocus": "center",
      "centerScale": 1.4,
      "scaleCenter": "off",
      "cornerRadius": 0
    }
  },
  {
    "id": "reference-stack-01",
    "label": "Stack 01",
    "mode": "rfStack",
    "duration": 11,
    "minSlots": 2,
    "maxSlots": 20,
    "values": {
      "zoom": 150,
      "delay": 0,
      "cycles": 1,
      "offsetX": 0,
      "offsetY": -2.5,
      "stagger": 0.06666666666666667,
      "visible": 3,
      "duration": 1.4000000000000001,
      "direction": "down",
      "planeSize": 38,
      "perspective": 73,
      "cornerRadius": 0
    }
  },
  {
    "id": "reference-stack-02",
    "label": "Stack 02",
    "mode": "rfStack",
    "duration": 11,
    "minSlots": 2,
    "maxSlots": 20,
    "values": {
      "zoom": 150,
      "delay": 0,
      "cycles": 1,
      "offsetX": 0,
      "offsetY": 2.5,
      "stagger": 0.06666666666666667,
      "visible": 3,
      "duration": 1.4000000000000001,
      "direction": "up",
      "planeSize": 38,
      "perspective": 73,
      "cornerRadius": 0
    }
  },
  {
    "id": "reference-stack-03",
    "label": "Stack 03",
    "mode": "rfStack",
    "duration": 8,
    "minSlots": 2,
    "maxSlots": 20,
    "values": {
      "zoom": 267,
      "delay": 0,
      "cycles": 1,
      "offsetX": 0,
      "offsetY": -7.5,
      "stagger": 0,
      "visible": 6,
      "duration": 1,
      "direction": "down",
      "planeSize": 24,
      "perspective": 123,
      "cornerRadius": 0
    }
  },
  {
    "id": "reference-stack-04",
    "label": "Stack 04",
    "mode": "rfStack",
    "duration": 8,
    "minSlots": 2,
    "maxSlots": 20,
    "values": {
      "zoom": 267,
      "delay": 0,
      "cycles": 1,
      "offsetX": 0,
      "offsetY": 7.5,
      "stagger": 0,
      "visible": 6,
      "duration": 1,
      "direction": "up",
      "planeSize": 24,
      "perspective": 123,
      "cornerRadius": 0
    }
  },
  {
    "id": "reference-flicker-01",
    "label": "Flicker 01",
    "mode": "rfFlicker",
    "duration": 6,
    "minSlots": 2,
    "maxSlots": 30,
    "values": {
      "delay": 0,
      "cycles": 1,
      "effect": "off",
      "offsetX": 0,
      "offsetY": 0,
      "driftDir": "up",
      "duration": 6,
      "scaleDir": "forward",
      "planeSize": 100,
      "fadeAmount": 50,
      "transition": "instant",
      "driftAmount": 30,
      "scaleAmount": 30,
      "cornerRadius": 0,
      "pacing": "equal"
    }
  },
  {
    "id": "reference-flicker-02",
    "label": "Flicker 02",
    "mode": "rfFlicker",
    "duration": 8,
    "minSlots": 2,
    "maxSlots": 30,
    "values": {
      "delay": 0,
      "cycles": 2,
      "effect": "off",
      "pacing": "eased",
      "offsetX": 0,
      "offsetY": 0,
      "driftDir": "up",
      "duration": 4,
      "scaleDir": "forward",
      "planeSize": 73,
      "driftAmount": 30,
      "scaleAmount": 30,
      "cornerRadius": 0
    }
  },
  {
    "id": "reference-flicker-03",
    "label": "Flicker 03",
    "mode": "rfFlicker",
    "duration": 6,
    "minSlots": 2,
    "maxSlots": 30,
    "values": {
      "delay": 0,
      "cycles": 1,
      "effect": "scale",
      "pacing": "equal",
      "offsetX": 0,
      "offsetY": 0,
      "driftDir": "up",
      "duration": 6,
      "scaleDir": "forward",
      "planeSize": 118,
      "driftAmount": 30,
      "scaleAmount": 15,
      "cornerRadius": 0
    }
  },
  {
    "id": "reference-flicker-04",
    "label": "Flicker 04",
    "mode": "rfFlicker",
    "duration": 6,
    "minSlots": 2,
    "maxSlots": 30,
    "values": {
      "delay": 0,
      "cycles": 1,
      "effect": "drift",
      "pacing": "equal",
      "offsetX": 0,
      "offsetY": 0,
      "driftDir": "up",
      "duration": 6,
      "scaleDir": "forward",
      "planeSize": 107,
      "driftAmount": 7,
      "scaleAmount": 30,
      "cornerRadius": 0
    }
  },
  {
    "id": "reference-flicker-05",
    "label": "Flicker 05",
    "mode": "rfFlicker",
    "duration": 6,
    "minSlots": 2,
    "maxSlots": 30,
    "values": {
      "delay": 0,
      "cycles": 1,
      "effect": "drift",
      "pacing": "equal",
      "offsetX": 0,
      "offsetY": 0,
      "driftDir": "left",
      "duration": 6,
      "scaleDir": "forward",
      "planeSize": 107,
      "driftAmount": 7,
      "scaleAmount": 30,
      "cornerRadius": 0
    }
  },
  {
    "id": "reference-flicker-06",
    "label": "Flicker 06",
    "mode": "rfFlicker",
    "duration": 8,
    "minSlots": 2,
    "maxSlots": 30,
    "values": {
      "delay": 0,
      "cycles": 1,
      "effect": "drift",
      "pacing": "equal",
      "offsetX": 0,
      "offsetY": 0,
      "driftDir": "up",
      "duration": 8,
      "scaleDir": "forward",
      "planeSize": 63,
      "driftAmount": 80,
      "scaleAmount": 30,
      "cornerRadius": 0
    }
  },
  {
    "id": "reference-flicker-07",
    "label": "Flicker 07",
    "mode": "rfFlicker",
    "duration": 8,
    "minSlots": 2,
    "maxSlots": 30,
    "values": {
      "delay": 0,
      "cycles": 1,
      "effect": "drift",
      "pacing": "equal",
      "offsetX": 0,
      "offsetY": 0,
      "driftDir": "left",
      "duration": 8,
      "scaleDir": "forward",
      "planeSize": 63,
      "driftAmount": 100,
      "scaleAmount": 30,
      "cornerRadius": 0
    }
  },
  {
    "id": "reference-flicker-08",
    "label": "Flicker 08",
    "mode": "rfFlicker",
    "duration": 8,
    "minSlots": 2,
    "maxSlots": 30,
    "values": {
      "delay": 0,
      "cycles": 1,
      "effect": "scale",
      "pacing": "equal",
      "offsetX": 0,
      "offsetY": 0,
      "driftDir": "left",
      "duration": 8,
      "scaleDir": "reverse",
      "planeSize": 63,
      "driftAmount": 40,
      "scaleAmount": 40,
      "cornerRadius": 0
    }
  },
  {
    "id": "reference-flicker-09",
    "label": "Flicker 09",
    "mode": "rfFlicker",
    "duration": 8,
    "minSlots": 2,
    "maxSlots": 30,
    "values": {
      "delay": 0,
      "cycles": 1,
      "effect": "scale",
      "pacing": "equal",
      "offsetX": 0,
      "offsetY": 0,
      "driftDir": "left",
      "duration": 8,
      "scaleDir": "forward",
      "planeSize": 63,
      "driftAmount": 40,
      "scaleAmount": 40,
      "cornerRadius": 0
    }
  },
  {
    "id": "reference-flicker-10",
    "label": "Flicker 10",
    "mode": "rfFlicker",
    "duration": 4,
    "minSlots": 2,
    "maxSlots": 30,
    "values": {
      "delay": 0,
      "cycles": 1,
      "effect": "scale",
      "pacing": "equal",
      "offsetX": 0,
      "offsetY": 0,
      "driftDir": "left",
      "duration": 3,
      "scaleDir": "reverse",
      "planeSize": 63,
      "driftAmount": 40,
      "scaleAmount": 5,
      "cornerRadius": 0
    }
  },
  {
    "id": "reference-scale-01",
    "label": "Scale 01",
    "mode": "rfScale",
    "duration": 4,
    "minSlots": 2,
    "maxSlots": 20,
    "values": {
      "stagger": 0.4,
      "duration": 2,
      "planeSize": 100,
      "cornerRadius": 0,
      "scaleStyle": "bloom",
      "growFrom": "center",
      "imageFit": "fit",
      "spin": 0
    }
  },
  {
    "id": "reference-scale-02",
    "label": "Scale 02",
    "mode": "rfScale",
    "duration": 4,
    "minSlots": 2,
    "maxSlots": 20,
    "values": {
      "fade": 0,
      "spin": 0,
      "spread": 0,
      "stagger": 0.4,
      "duration": 2,
      "growFrom": "center",
      "imageFit": "fit",
      "planeSize": 100,
      "scaleStyle": "recede",
      "cornerRadius": 0
    }
  },
  {
    "id": "reference-scale-03",
    "label": "Scale 03",
    "mode": "rfScale",
    "duration": 4,
    "minSlots": 2,
    "maxSlots": 20,
    "values": {
      "fade": 0,
      "spin": -45,
      "spread": 0,
      "stagger": 0.4,
      "duration": 2,
      "growFrom": "center",
      "imageFit": "fit",
      "planeSize": 100,
      "scaleStyle": "bloom",
      "cornerRadius": 0
    }
  },
  {
    "id": "reference-scale-04",
    "label": "Scale 04",
    "mode": "rfScale",
    "duration": 5,
    "minSlots": 2,
    "maxSlots": 20,
    "values": {
      "spin": 0,
      "spread": 0,
      "stagger": 0.6,
      "duration": 4,
      "growFrom": "bottom",
      "imageFit": "fit",
      "planeSize": 100,
      "scaleStyle": "bloom",
      "cornerRadius": 0
    }
  }
] as const;

export const referencePresets = [...seriesPresets,...motifPresets].map(preset=>{
  const info=recipePresentation[recipeKey(preset)];
  const rowGroup=rowGalleryGroups.findIndex(group=>group.includes(preset.id));
  const suffix=preset.mode==="motif"?"":` ${rowGroup>=0?String(rowGroup+1).padStart(2,"0"):preset.id.split("-").slice(-1)[0]}`;
  return {...preset,label:info.name+suffix};
});
export type ReferencePresetId = typeof referencePresets[number]["id"];
export const referencePreset = (id: string) => referencePresets.find(preset => preset.id === id);
const galleryAlternates=new Set(rowGalleryGroups.flatMap(group=>group.slice(1)));
const galleryCounters=new Map<string,number>();
export const activeReferencePresets=referencePresets
  .filter(preset=>recipePresentation[recipeKey(preset)].available&&!galleryAlternates.has(preset.id)&&!retiredGalleryPresets.has(preset.id))
  .map(preset=>{
    if(preset.mode==="motif")return preset;
    const name=recipePresentation[recipeKey(preset)].name;
    const number=(galleryCounters.get(name)??0)+1;
    galleryCounters.set(name,number);
    return {...preset,label:`${name} ${String(number).padStart(2,"0")}`};
  });
const renderers=new Map<string,typeof referencePresets[number]>();
for(const preset of referencePresets)if(!renderers.has(recipeKey(preset)))renderers.set(recipeKey(preset),preset);
export const referenceDefinition=(settings:{preset:string;renderer?:string})=>settings.renderer&&settings.renderer!=="auto"
  ? renderers.get(settings.renderer)
  : referencePreset(settings.preset);
