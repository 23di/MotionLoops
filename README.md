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
- Refresh an existing Motion Loops animation or clear its generated tracks

The pseudo-3D presets use the Motion properties currently available to plugins: X/Y translation, X/Y scale, rotation, and opacity. Depth is simulated with projected paths, scale, opacity, and layer ordering.

## Presets

The active catalog includes Row 01–03, Stack 01–02, Vortex, Circle, Cilinder, Orbit 01–03, Contour, Globe, Coil, Counterflow and Ripple. Row's direction variants share one tile. Retired snapshots remain available to existing saved animations, not the gallery. Dimensions are stored as percentages and resolved against the target frame; timing stays in seconds and angles in degrees.

This is **41 implemented presets, not the full 245-entry reference export**. Remaining recipes are not advertised as supported or silently approximated. Only editable native and native pseudo-3D output is in scope; rasterized video and true projective image deformation are not substitutes.

All families use the same versioned settings document and generic editor. Preset identity is provenance, not evaluator dispatch. See [ARCHITECTURE.md](ARCHITECTURE.md) for the registry, adapters, migration and extension rules.

Orbit offers ring and flat variations; Path offers wave and track. Crosscurrent moves staggered rows in opposite directions with a gentle diagonal. Tile Wave builds a grid diagonally, holds it, and dissolves it outward. Both use frame-relative geometry, custom timing, and card-count-aware fitting. Retired variants (including Swing) stay compatible with existing files but are not shown in the gallery.

Use the presets icon in the preview to choose an animation or load a saved preset from the gallery. Changed settings appear as Current with a save icon; saved versions have a delete icon. Editing a loaded version creates a draft and never silently changes the saved snapshot. Selecting a variation starts from its own defaults and preserves the target selection scope. Controls use DialKit. Existing preset IDs and JSON settings remain supported, including advanced parameters no longer exposed in the interface. Geometry uses percentages; the engine resolves these into Figma coordinates.

`npm test` checks the catalog, visible motion controls, preset isolation, JSON round trips, multiple frame sizes and card counts, loop endpoints, and generated Figma tracks. Browser QA is separate from playback in the native Figma Motion runtime.

`npm run audit:reference` additionally compares the native scene evaluators against isolated public source-renderer functions, across portrait/landscape frames, image counts, and loop phases. This development-only audit needs network access; the plugin itself does not. Export tests sample generated native tracks, including image opacity, layer handoffs, refresh, and linked-source Clear. Original layers are retained and restored by Clear; service copies are editable cloned layers clipped to the target frame. Combinations requiring more than 256 service copies are rejected before changing the document.

## Run locally

1. Run `npm install`.
2. Run `npm run build`.
3. In Figma Desktop, open **Plugins → Development → Import plugin from manifest…**.
4. Choose this project's `manifest.json`.
5. Open a Figma Design file, switch to Motion, select layers inside a top-level frame, and run **Motion Loops**.

The source builds to `dist`, which is intentionally excluded from the repository. Figma Motion and its Plugin API are currently in beta, so API behavior may change.

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
