# Orbit Animator

Figma plugin for creating editable orbit, carousel, path, and pseudo-3D animation directly in Figma Motion. Choose a preset, adjust the geometry and appearance, then generate native keyframes in a few clicks.

Orbit Animator is completely free. Everything runs locally — no analytics, no tracking, and no network access.

## Features

- Create editable Figma Motion keyframes from selected layers
- Choose from 9 distinct animation families with 21 quick variations
- Fit motion automatically to the selected frame or set the radii manually
- Change variation, direction, and applicable angles in a single quick-settings row
- Adjust timing and spacing in Motion, scale and effects in Look, and selection/saved variations in Setup
- Preview the generated animation before applying it
- Save custom presets locally and reuse them later
- Refresh an existing Orbit animation or clear its generated tracks

The pseudo-3D presets use the Motion properties currently available to plugins: X/Y translation, X/Y scale, rotation, and opacity. Depth is simulated with projected paths, scale, opacity, and layer ordering.

## Presets

Orbit, Path, Carousel, Stack, Sphere, Fan, Swing, Spiral, and Field.

Related motions live inside each family: Orbit includes flat, vertical, tilted, and soft-focus variations; Path includes wave, track, arc, figure eight, and helix; Carousel includes deck, focus, and step; Stack includes fall and shuffle; Field includes scatter and rows.

Selecting a variation starts from its own defaults and preserves the target selection scope. Custom variations can be saved under Setup. Existing preset IDs and JSON settings remain supported, including advanced parameters no longer exposed in the interface. Geometry uses percentages; the engine resolves these into Figma coordinates.

`npm test` checks the catalog, visible motion controls, preset isolation, JSON round trips, multiple frame sizes and card counts, loop endpoints, and generated Figma tracks. Browser QA is separate from playback in the native Figma Motion runtime.

## Run locally

1. Run `npm install`.
2. Run `npm run build`.
3. In Figma Desktop, open **Plugins → Development → Import plugin from manifest…**.
4. Choose this project's `manifest.json`.
5. Open a Figma Design file, switch to Motion, select layers inside a top-level frame, and run **Orbit Animator**.

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
