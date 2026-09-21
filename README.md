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
