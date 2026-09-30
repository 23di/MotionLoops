# Reddit showcase

[MP4 video](motion-loops-reddit.mp4) · [GIF preview](motion-loops-preview.gif)

24 seconds · 1080 × 1080 · 30 fps · H.264 · no audio.

Four six-second chapters: **Orbit 04**, **Row 02**, **Stack 01**, **Vortex**.
Each chapter plays one full preset cycle, retimed to six seconds. The original
geometric card artwork is shared across all four chapters.

The video renders the actual scene and keyframe functions used by the plugin
preview. It is a showcase of those presets, not a recording of the Figma UI.

## Rebuild

Install the project dependencies, Python with Pillow, and ffmpeg, then run:

```sh
node scripts/render-reddit-demo.mjs
```

The renderer uses Helvetica on macOS or DejaVu Sans on Linux. Set
`MOTION_DEMO_FONT` to a local font path to override it.

## Suggested Reddit post

**Title:** I built a free Figma plugin that turns layers into editable motion loops

**Body:**

I've been building Motion Loops, a free plugin for Figma Motion. Here's a quick
look at four presets: Orbit, Row, Stack, and Vortex.

Select your layers, pick a preset, adjust the movement, and generate native,
editable keyframes. You can refresh the animation as you tweak it or clear it
and return to your original layout.

I'd love to hear which motion you'd use, and what preset you'd want next.

Source: https://github.com/23di/MotionLoops
