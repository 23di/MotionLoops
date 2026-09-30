# Release verification — 2026-09-30

Verified the local production build before the public launch. This is evidence
for the scenarios below, not a claim of coverage of every Figma environment.

## Newly covered regression

Duplicating an animated native frame preserves plugin data referring to the
original cards. Linked-card selection and Clear previously followed those IDs
into the original frame. They now resolve the complete group within its owner.
Service discovery preserves separately owned native compositions in other
frames while retaining recovery of moved service layers without local owners.

The exporter regression checks Refresh and Clear from a single duplicated
card and asserts that the original markers and service root survive.

## Manual Figma Desktop verification

File: Share, Portfolio page. Original frame: `5676:59405`.
Test copy: `5682:52030`, named **Motion Loops — release QA copy**.

- Started with a copy of the user's already animated Stack composition.
- Restarted the development plugin using the current build.
- Enabled Start when card is main and refreshed: completed successfully.
- Received the expected warning for Ellipse 2's unnamed internal track;
  the public API cannot retime that track.
- Disabled the option and refreshed: completed successfully.
- Cleared the external animation: the native timeline retained 73 tracks and
  147 keys belonging to the original artwork.
- Closed and reopened the file. The cleared copy and original Stack output
  persisted; the saved file tree confirmed both states.
- Reopened the plugin: gallery offered **Stack**, with no Stack 02 entry.
- Applied Row 02 to the cleared copy after reopening: completed successfully.
- Native Undo removed the new composition while retaining the original Stack.
- Native Redo restored the Row timeline: 691 tracks and 2,591 keys.
- Played the restored Row timeline through multiple cycles and inspected it
  visually; then paused playback on the QA copy.

## Automated/build verification

- `npm test`: nested timing and ID replacement, rollback, all 41 native
  reference exports, Refresh/Clear, catalog, persistence, loop seams,
  4,319 parameter changes across 65 presets, and visual trace baselines passed.
- `npm run typecheck` and `npm run build`: passed.
- `npm run audit:reference`: 25,920 reference scene comparisons and
  5,760 motif scene comparisons passed.
- Both production JavaScript bundles parsed successfully; the UI contained
  one inline script, no unexpanded placeholders, and no remote script/style
  dependencies. Manifest paths exist, network access is `none`, and bundled
  third-party notices are present.
- `git diff --check`: passed.

## Remaining limits

The Community installation/update flow under a separate account and other OS
or Figma client versions were not manually tested. The public API limitation
for unnamed tracks remains disclosed. Springs crossing a nested reset still
require a longer outer cycle or a shorter inner animation.
