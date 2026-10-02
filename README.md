# Motion Loops

Figma plugin for creating editable orbit, carousel, path, and pseudo-3D animation directly in Figma Motion. Choose a preset, adjust the geometry and appearance, then generate native keyframes in a few clicks.

Motion Loops is completely free. Everything runs locally — no analytics, no tracking, and no network access.

## Features

- Create editable Figma Motion keyframes from selected layers
- Choose from a curated native/pseudo-3D gallery; retired presets remain readable
- Fit motion automatically to the selected frame or set the radii manually
- Change variation, direction, and applicable angles in a single quick-settings row
- Use one capability-driven DialKit editor: Motion, Cards, Trajectory and Other
- Preview the generated animation before applying it
- Save custom presets locally and reuse them later
- Choose a UI language in Other, with automatic detection and a saved manual override
- Refresh an existing Motion Loops animation or clear its generated tracks
- Start animations inside a card when it enters the frame, with an earlier/later offset

The pseudo-3D presets use the Motion properties currently available to plugins: X/Y translation, X/Y scale, rotation, and opacity. Depth is simulated with projected paths, scale, opacity, and layer ordering.

Select the outer card groups and enable **Motion → Start when card is main** to align their nested animations to each time a card becomes the main card during the cycle. **Offset (s)** appears below it: zero is centered, negative starts earlier, positive starts later. Existing delays between child animations remain intact. Native card compositions wrap playback across the timeline boundary: a returning duplicate starts as soon as it becomes main, and its remaining animation continues at time zero.

Apply converts nested Figma presets to manual keyframes using Motion Stagger's converter, including their existing preset offsets. Conversion is a separate native Undo step. Reapplying uses the saved original timing, so offsets do not accumulate. Disable the toggle and Apply, or Clear the outer animation, to restore the original nested timing; converted presets remain editable keyframes. Depth copies share timing across layer handoffs. The plugin preview shows card movement; nested playback is visible in Figma Motion after Apply.

## Interface language

**Other → Language** offers Automatic, English, Japanese, Korean, French, German, Spanish for Spain or Latin America, and Brazilian Portuguese — the [languages supported by Figma](https://help.figma.com/hc/en-us/articles/6956360971415-Change-your-language-preference).

Automatic follows the first supported language in the browser/system preferences exposed to the plugin iframe, using English when none match. Manual choices persist locally, and selecting Automatic restores detection. Figma does not expose its account language through the plugin API. Switching UI language preserves motion settings, JSON keys, preset IDs, and custom preset names. Built-in recipe names and automatically generated saved-preset names are translated for display. Technical diagnostics and unknown host errors retain their original text.

## Demo

[Watch four presets in motion](docs/demo/motion-loops-reddit.mp4) · [GIF preview and Reddit post draft](docs/demo/README.md).

## Tech Stack

- [React](https://react.dev/) — plugin interface
- [DialKit](https://www.dialkit.dev/) — controls and preset management
- [Motion](https://motion.dev/) — live animation preview
- [TypeScript](https://www.typescriptlang.org/) — application code
- [esbuild](https://esbuild.github.io/) — build tooling

## You can also try

[Color Shuffler — Explore and adjust UI color palettes](https://www.figma.com/community/plugin/1622294161663649835).

## License

This project is licensed under the Creative Commons Attribution-NonCommercial 4.0 International License (CC BY-NC 4.0). See [LICENSE](LICENSE) for the full license text. Third-party runtime licenses are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Figma may expose internal animation tracks with an empty property name. These tracks cannot be retimed through the public API. Apply preserves their original timing and reports the affected layers while shifting supported nested tracks.

Nested playback starts when a Stack card becomes the foreground card, a native carousel card becomes central, or a trajectory reaches its foreground pose. Offset shifts this moment earlier or later.

With **Start when card is main**, supported nested tracks restart on every foreground occurrence. Returning native cards carry playback continuously through the loop seam. Refresh and Clear retain their authored timing. Linear and cubic segments that cross the seam are clipped while preserving their curve. A spring crossing the reset requires a longer cycle or shorter inner animation.

Wrapping Path Trim animations (including FLOW at 150–200%) now participate in nested looping. Motion Loops splits whole-path crossings into editable 0–100% keyframes, preserving the visible motion instead of clamping it. Figma’s native setters reject trim values above 100%, even though its editor can author and play them. Refresh reuses the saved baseline; Clear restores the authored timing with this equivalent bounded notation on edited layers. Untouched native source cards retain their original notation. Wrapping springs and non-monotonic easing remain unchanged and produce a warning.

Independent **Loop card animation** playback fits the nearest whole number of card cycles into the outer scene duration. For example, a 1.2s card animation in a 5s scene plays four 1.25s cycles instead of restarting halfway through the next lap at the global seam. All child tracks and delays scale together. **Start when card is main** retains the authored timing relative to each foreground occurrence. Clear restores the authored timing.

Apply and Refresh request the scene duration after writing the animation. If Figma retains an existing timeline duration, the update succeeds with that duration unchanged; the generated keyframes still use the cycle duration selected in Motion Loops.
