// Product-facing library metadata is separate from stable saved-file IDs.
export const recipePresentation:Record<string,{name:string;available:boolean}>={
  rfCarousel:{name:"Row",available:true},
  rfStack:{name:"Stack",available:true},
  rfFlicker:{name:"Strobe",available:false},
  rfScale:{name:"Expand",available:false},
  LoopSwirlTemplate:{name:"Vortex",available:true},
  LoopRingTemplate:{name:"Circle",available:true},
  LoopCircleTemplate:{name:"Cilinder",available:false},
  LoopSwipeTemplate:{name:"Reorder",available:false},
  LoopBoardTemplate:{name:"Scatter",available:false},
};
export const recipeKey=(preset:{mode:string;templateId?:string})=>preset.templateId??preset.mode;

// Each Row pair is the same composition tuned for vertical/horizontal travel.
// Keep both snapshots loadable, but offer one entry and the direction control.
export const rowGalleryGroups = [
  ["reference-carousel-01", "reference-carousel-02"],
  ["reference-carousel-03", "reference-carousel-04"],
  ["reference-carousel-05", "reference-carousel-06"],
  ["reference-carousel-07", "reference-carousel-08"],
  ["reference-carousel-09", "reference-carousel-10"],
  ["reference-carousel-11", "reference-carousel-12"],
  ["reference-carousel-13", "reference-carousel-14"],
  ["reference-carousel-15", "reference-carousel-16"],
  ["reference-carousel-17", "reference-carousel-18"],
];

// Row 07 and Row 08 are retained only for old saved documents. Row 06 is the
// single large-edge recipe offered in the gallery.
export const retiredGalleryPresets = new Set([
  "reference-stack-02", "reference-stack-03",
  "reference-carousel-01", "reference-carousel-02",
  "reference-carousel-03", "reference-carousel-04",
  "reference-carousel-09", "reference-carousel-10",
  "reference-carousel-13", "reference-carousel-14",
  "reference-carousel-15", "reference-carousel-16",
  "reference-carousel-17", "reference-carousel-18",
]);
