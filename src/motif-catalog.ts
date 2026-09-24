// Metadata from the supplied preset export, retained as the editor schema.
export const motifPresets = [
  {
    "collection": "motif",
    "templateId": "LoopSwirlTemplate",
    "productSettings": {"turns":4},
    "label": "Swirl",
    "description": "Media rides a spiral between the edge of the frame and its centre, turning to follow the curve.",
    "category": "Spiral",
    "source": "spiralimages",
    "defaultDuration": 12,
    "defaultBorderRadius": 26,
    "minSlots": 1,
    "maxSlots": 24,
    "defaultCropAspect": "1:1",
    "params": [
      {
        "type": "slider",
        "key": "visibleCount",
        "label": "Visible objects",
        "group": "template",
        "min": 1,
        "max": 100,
        "step": 1,
        "default": 24
      },
      {
        "type": "slider",
        "key": "scaleIntensity",
        "label": "Media Scale",
        "group": "appearance",
        "subgroup": "_size",
        "min": 0.06,
        "max": 0.35,
        "step": 0.01,
        "default": 0.23
      },
      {
        "type": "slider",
        "key": "fadeIn",
        "label": "Edge Fade",
        "tooltip": "How much of the outer path each piece spends fading in.",
        "min": 0,
        "max": 50,
        "step": 1,
        "unit": "%",
        "default": 20,
        "group": "appearance"
      },
      {
        "type": "slider",
        "key": "turns",
        "label": "Turns",
        "tooltip": "Times the spiral wraps between the edge and the centre.",
        "min": 1.5,
        "max": 6,
        "step": 0.1,
        "default": 3.5,
        "group": "template"
      },
      {
        "type": "slider",
        "key": "spacing",
        "label": "Spacing",
        "tooltip": "Distance between pieces along the spiral.",
        "min": 2,
        "max": 14,
        "step": 0.5,
        "default": 4,
        "group": "template"
      },
      {
        "type": "slider",
        "key": "spread",
        "label": "Spread",
        "tooltip": "How far the outer arm reaches past the frame.",
        "min": 1,
        "max": 10,
        "step": 0.5,
        "default": 7,
        "group": "template"
      },
      {
        "type": "slider",
        "key": "depthFalloff",
        "label": "Depth Falloff",
        "tooltip": "How much smaller a piece gets as it nears the centre.",
        "min": 0,
        "max": 4,
        "step": 0.1,
        "default": 2,
        "group": "template"
      },
      {
        "type": "select",
        "key": "direction",
        "label": "Direction",
        "default": "inward",
        "group": "animation",
        "options": [
          {
            "value": "inward",
            "label": "Inward"
          },
          {
            "value": "outward",
            "label": "Outward"
          }
        ]
      }
    ],
    "id": "reference-spiralimages",
    "mode": "motif",
    "duration": 12,
    "values": {}
  },
  {
    "collection": "motif",
    "templateId": "LoopRingTemplate",
    "productSettings": {"radiusX":36},
    "label": "Ring",
    "description": "A ring of cards spinning around one centre, each turned to follow the curve.",
    "category": "Orbit",
    "source": "hoop",
    "defaultDuration": 16,
    "defaultBorderRadius": 24,
    "minSlots": 2,
    "maxSlots": 24,
    "defaultCropAspect": "1:1",
    "params": [
      {
        "type": "slider",
        "key": "scaleIntensity",
        "label": "Media Scale",
        "group": "appearance",
        "subgroup": "_size",
        "min": 0.15,
        "max": 0.5,
        "step": 0.01,
        "default": 0.2
      },
      {
        "type": "slider",
        "key": "radiusX",
        "label": "Ring Width",
        "tooltip": "Half the ring’s width, as a share of the frame’s short edge.",
        "min": 10,
        "max": 60,
        "step": 1,
        "default": 32,
        "group": "template"
      },
      {
        "type": "slider",
        "key": "radiusY",
        "label": "Ring Height",
        "tooltip": "Half the ring’s height. Below the width it flattens into an ellipse.",
        "min": 5,
        "max": 60,
        "step": 1,
        "default": 32,
        "group": "template"
      },
      {
        "type": "slider",
        "key": "repeat",
        "label": "Repeats",
        "tooltip": "How many times the media runs around the ring.",
        "min": 1,
        "max": 8,
        "step": 1,
        "default": 1,
        "group": "template"
      },
      {
        "type": "toggle",
        "key": "tangent",
        "label": "Follow Curve",
        "tooltip": "Turn each card to sit along the ring rather than upright.",
        "default": true,
        "group": "template"
      },
      {
        "type": "select",
        "key": "direction",
        "label": "Direction",
        "default": "anticlockwise",
        "group": "animation",
        "options": [
          {
            "value": "anticlockwise",
            "label": "Anticlockwise"
          },
          {
            "value": "clockwise",
            "label": "Clockwise"
          }
        ]
      },
      {
        "type": "select",
        "key": "stack",
        "label": "Stacking",
        "default": "lastOnTop",
        "group": "template",
        "options": [
          {
            "value": "lastOnTop",
            "label": "Last on Top"
          },
          {
            "value": "firstOnTop",
            "label": "First on Top"
          }
        ]
      }
    ],
    "id": "reference-hoop",
    "mode": "motif",
    "duration": 16,
    "values": {}
  },
  {
    "collection": "motif",
    "templateId": "LoopSwipeTemplate",
    "label": "Swipe",
    "description": "A fanned deck that throws its top card aside and sends it to the back, over and over.",
    "category": "Deck",
    "source": "shuffle",
    "defaultDuration": 12,
    "defaultBorderRadius": 24,
    "minSlots": 2,
    "maxSlots": 16,
    "defaultCropAspect": "4:5",
    "params": [
      {
        "type": "slider",
        "key": "scaleIntensity",
        "label": "Media Scale",
        "group": "appearance",
        "subgroup": "_size",
        "min": 0.35,
        "max": 0.8,
        "step": 0.01,
        "default": 0.645
      },
      {
        "type": "slider",
        "key": "tiltAngle",
        "label": "Fan Angle",
        "tooltip": "How far the deck fans out from the top card.",
        "min": -60,
        "max": 60,
        "step": 1,
        "unit": "°",
        "default": -45,
        "group": "template"
      },
      {
        "type": "slider",
        "key": "xOffset",
        "label": "Fan Spread",
        "tooltip": "How far the back of the deck sits from the top card.",
        "min": 0,
        "max": 300,
        "step": 5,
        "default": 10,
        "group": "template"
      },
      {
        "type": "slider",
        "key": "stackOffset",
        "label": "Stack Lift",
        "tooltip": "How much each card behind lifts above the one in front.",
        "min": 0,
        "max": 24,
        "step": 1,
        "default": 8,
        "group": "template"
      },
      {
        "type": "select",
        "key": "direction",
        "label": "Direction",
        "default": "right",
        "group": "animation",
        "options": [
          {
            "value": "right",
            "label": "Rightwards"
          },
          {
            "value": "left",
            "label": "Leftwards"
          }
        ]
      },
      {
        "type": "select",
        "key": "easing",
        "label": "Easing",
        "default": "smooth",
        "group": "animation",
        "options": [
          {
            "value": "smooth",
            "label": "Smooth"
          },
          {
            "value": "snappy",
            "label": "Snappy"
          },
          {
            "value": "elastic",
            "label": "Elastic"
          },
          {
            "value": "linear",
            "label": "Linear"
          }
        ]
      }
    ],
    "id": "reference-shuffle",
    "mode": "motif",
    "duration": 12,
    "values": {}
  },
  {
    "collection": "motif",
    "templateId": "LoopCircleTemplate",
    "label": "Circle",
    "description": "Concentric rings of cards turning around one centre, each set at its own small angle.",
    "category": "Orbit",
    "source": "cluster",
    "defaultDuration": 18,
    "defaultBorderRadius": 20,
    "minSlots": 1,
    "maxSlots": 24,
    "defaultCropAspect": "1:1",
    "defaultAspectRatio": "1:1",
    "params": [
      {
        "type": "slider",
        "key": "scaleIntensity",
        "label": "Media Scale",
        "group": "appearance",
        "subgroup": "_size",
        "min": 0.06,
        "max": 0.3,
        "step": 0.01,
        "default": 0.16
      },
      {
        "type": "slider",
        "key": "cards",
        "label": "Cards",
        "tooltip": "How many cards are shared out across the rings.",
        "min": 8,
        "max": 120,
        "step": 1,
        "default": 24,
        "group": "template"
      },
      {
        "type": "slider",
        "key": "rings",
        "label": "Rings",
        "min": 1,
        "max": 6,
        "step": 1,
        "default": 2,
        "group": "template"
      },
      {
        "type": "slider",
        "key": "innerRadius",
        "label": "Inner Radius",
        "tooltip": "Radius of the innermost ring, as a share of the short edge.",
        "min": 5,
        "max": 60,
        "step": 1,
        "default": 14,
        "group": "template"
      },
      {
        "type": "slider",
        "key": "ringGap",
        "label": "Ring Gap",
        "tooltip": "Distance between one ring and the next.",
        "min": 5,
        "max": 50,
        "step": 1,
        "default": 23,
        "group": "template"
      },
      {
        "type": "slider",
        "key": "tilt",
        "label": "Card Tilt",
        "tooltip": "How far each card may sit off square.",
        "min": 0,
        "max": 45,
        "step": 1,
        "unit": "°",
        "default": 0,
        "group": "appearance"
      },
      {
        "type": "slider",
        "key": "turns",
        "label": "Turns",
        "tooltip": "Full revolutions per cycle.",
        "min": 1,
        "max": 4,
        "step": 1,
        "default": 1,
        "group": "animation"
      },
      {
        "type": "select",
        "key": "direction",
        "label": "Direction",
        "default": "cw",
        "group": "animation",
        "options": [
          {
            "value": "cw",
            "label": "Clockwise"
          },
          {
            "value": "ccw",
            "label": "Anticlockwise"
          },
          {
            "value": "alternate",
            "label": "Alternate"
          }
        ]
      }
    ],
    "id": "reference-cluster",
    "mode": "motif",
    "duration": 18,
    "values": {}
  },
  {
    "collection": "motif",
    "templateId": "LoopBoardTemplate",
    "label": "Board",
    "description": "An endless shuffled grid of media drifting steadily across the frame.",
    "category": "Grid",
    "source": "board",
    "defaultDuration": 18,
    "defaultBorderRadius": 16,
    "minSlots": 2,
    "maxSlots": 24,
    "defaultCropAspect": "1:1",
    "tiles": true,
    "defaultAspectRatio": "1:1",
    "params": [
      {
        "type": "slider",
        "key": "scaleIntensity",
        "label": "Media Scale",
        "group": "appearance",
        "subgroup": "_size",
        "min": 0.12,
        "max": 0.5,
        "step": 0.01,
        "default": 0.3
      },
      {
        "type": "slider",
        "key": "spacing",
        "label": "Spacing",
        "min": 0,
        "max": 10,
        "step": 0.5,
        "default": 2,
        "group": "template"
      },
      {
        "type": "select",
        "key": "direction",
        "label": "Drift Direction",
        "default": "up-left",
        "group": "template",
        "options": [
          {
            "value": "up-left",
            "label": "Up and Left"
          },
          {
            "value": "up",
            "label": "Up"
          },
          {
            "value": "up-right",
            "label": "Up and Right"
          },
          {
            "value": "right",
            "label": "Right"
          },
          {
            "value": "down-right",
            "label": "Down and Right"
          },
          {
            "value": "down",
            "label": "Down"
          },
          {
            "value": "down-left",
            "label": "Down and Left"
          },
          {
            "value": "left",
            "label": "Left"
          }
        ]
      },
      {
        "type": "slider",
        "key": "travel",
        "label": "Drift Speed",
        "tooltip": "Cells the field travels in one cycle. Very slow settings are held back to whatever keeps the shuffle from repeating on screen.",
        "min": 4,
        "max": 60,
        "step": 1,
        "default": 18,
        "group": "template"
      }
    ],
    "id": "reference-board",
    "mode": "motif",
    "duration": 18,
    "values": {}
  }
] as const;
type Presentation<T> = T extends unknown ? Omit<T,"label"> & {label:string} : never;
export type MotifPreset = Presentation<typeof motifPresets[number]>;
