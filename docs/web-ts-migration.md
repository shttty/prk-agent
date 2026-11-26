# Web TypeScript and native-layout migration

`web/` moves from JavaScript to TypeScript and from measured, absolutely positioned layout to Mantine's own layout components. Batch 0 laid the toolchain and migrated `web/design-system/` as the pattern to copy; read its files and the conventions in [the web skill](../.agents/skills/pi-remote-kernel-web/SKILL.md#typescript-types-and-layout) first.

## Batches

Each batch is one directory group and may edit only that group. Directories that are not yet migrated stay valid because renamed files still resolve through their old `./x.js` and `./x.jsx` specifiers.

1. `web/workbench` (store and protocol layer)
2. `web/instances`, `web/monitor`, `web/sessions`
3. `web/settings`, `web/shell`, `web/workspace`
4. `web/chat` (the lightbox moves to `yet-another-react-lightbox`)

## Steps for a batch worker

1. Take screenshots of the affected pages first (light and dark, desktop and phone) for the before/after pair.
2. Rename with `git mv` (`.js` to `.ts`, `.jsx` to `.tsx`). Do not touch other directories' imports.
3. Add types: props, state, events, refs, Mantine types, wire types from `src/gateway/wire/web-types.ts`. No `any`; `as` only at input boundaries.
4. Replace layout with Group, Flex, Stack, SimpleGrid, Popover, Menu, Modal or Drawer where the skill's table says so; keep the documented exceptions with a comment.
5. Delete dead styles: CSS rules and class names that nothing selects, and abstractions left with one caller.
6. Shrink your allowlist files in `scripts/verification/structure-allowlist/` (`web-<directory>.txt`): split files that break the size, one-function or naming rule and delete their lines. Never add a line.
7. Run `npm test` and the browser cases that cover your directory (`test/browser/`, with the environment from [the test environment](kernel-recovery.md#test-environment)); take the after screenshots and compare.
8. Commit with English conventional messages and point a branch at the result (`git branch -f <name> HEAD`).

Do not run the full `npm run check` in parallel with other batches: the parent session merges the branches and runs it once, serially.
