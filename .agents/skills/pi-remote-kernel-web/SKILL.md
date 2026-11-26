---
name: pi-remote-kernel-web
description: Use when changing or verifying the PRK Web workbench.
---

# PRK Web workbench

## Development and verification

- Use the checkout's own root and `web/` dependencies. The Vite dev command and API URL are in [README.md](../../../README.md#development); installation and startup are in [INSTALL.md](../../../INSTALL.md).
- Browser journeys in `test/browser/` use real Chromium, Vite, Web and a Gateway with the SDK faux provider. Scope locators to stable IDs, `data-action`, or machine-readable `data-*` state; do not assert UI wording.
- Follow the [verification tiers](../../../AGENTS.md#验收与任务交接). Choose relevant integration coverage from the final diff; keep browser and external-process tests out of the unit suite.

## Implementation boundaries

- `web/` communicates with the backend only through same-origin `/api` HTTP, SSE and WebSocket routes. Frontend code does not import `src/`, except `import type` from `src/gateway/wire/web-types.ts` (see [Types](#types)). Vite rewrites `Origin` only for requests from the page's own origin; preserve the backend's origin checks.
- Take conversation, session and tool availability from Gateway and SDK state. Do not add shadow user messages, deduplicate by text, or infer progress the backend does not report. Preserve narrow render dependencies; snapshots and terminal telemetry should not rerender unrelated conversation content.
- Use the design system and `--pi-*` tokens. Keep separate light and dark contrast checks and verify desktop and phone layouts. Put message actions on that message, session actions in its sidebar menu or detail panel, and reserve `/` for command input, skills and templates.
- User-facing notices state what happened and, if useful, one next action. Prefer existing alerts and status pills over duplicate notices. Keep the chat non-dockable and use the workspace for file and terminal panels.
- For SDK component and tool renderer semantics, read [Pi SDK references](../../../docs/pi-sdk/README.md). Cross-process interface changes follow [the contract](../../../docs/contract.md).

## TypeScript, types and layout

Checks: `npm test` runs `tsc -p web/tsconfig.json` (`strict`, `noUncheckedIndexedAccess`, `allowJs`, `checkJs: false`, `erasableSyntaxOnly`, `verbatimModuleSyntax`) and `eslint` with typescript-eslint, so migrated and unmigrated files share one program. `web/` keeps its own `typescript` 6.0.x only because typescript-eslint cannot load TypeScript 7 (peer `<6.1`); delete that devDependency once typescript-eslint supports 7. Type-aware lint rules read the same `web/tsconfig.json` as `tsc`.

### Renaming and imports

- Rename with `git mv foo.js foo.ts` (`.jsx` to `.tsx`). Importers in other directories keep `./foo.js` or `./foo.jsx`: Vite (dev and build) and `tsc` resolve it to the renamed file, and Node's unit runner does through `scripts/verification/resolve-web-sources.mjs`. Do not edit another directory to follow a rename.
- Inside files you migrate, write the real extension for targets you migrated too (`./foo.ts`); leave `.js` and `.jsx` for targets in directories that may still be JavaScript.
- A module that `test/unit` imports runs under Node's type stripping: keep it a JSX-free `.ts`, erasable syntax only (no `enum`, `namespace`, parameter properties), `import type` for types. Put logic and components in separate files; `npm test` rejects a unit test that imports `.jsx` or `.tsx`.

### Types

- Props: `type XProps = { ... }` in the component's file, directly above it. Use the exported Mantine types instead of re-describing them: `type InlineAlertProps = AlertProps & { size?: MantineSize }`, `ElementProps<"div">`, `SwitchProps`.
- No `any` (lint error). Use `unknown` and narrow. `as` only where outside data enters (API replies, JSON, storage), validated once there; inside the app pass typed values. Narrow DOM results with `instanceof`, not `as`.
- Store and state types live in the directory of the object that owns them, in a `*-types.ts` file (exempt from the one-function rule). Wire and snapshot types come from `src/gateway/wire/web-types.ts` with `import type` only; add a type by re-exporting it there under your directory's heading, never by copying it.
- Events and refs: `useRef<HTMLDivElement>(null)`, `KeyboardEvent<HTMLElement>`, `ChangeEvent<HTMLInputElement>`; a class component declares `Component<Props, State, Snapshot>`.

```tsx
type StatusDotProps = { tone: StatusTone; size?: number; className?: string };
export default function StatusDot({ tone, size = 8, ...props }: StatusDotProps) { ... }
```

### Layout

Let the component library lay things out; CSS keeps only what no layout component gives (colour, border, shadow, radius, transition).

| Need | Use |
| --- | --- |
| Side by side | `Group` (wraps, even gaps) or `Flex` (`align`, `justify`, `wrap`, `gap`, `flex`) |
| Stacked | `Stack` |
| Grid, equal cells | `SimpleGrid`, `Grid` |
| Follows an element | `Popover`, `Menu`, `Tooltip`, `Combobox` (Floating UI underneath) |
| Full screen | `Modal` (`fullScreen`), `Drawer` |
| Reset a button | `UnstyledButton`; spacing and size through style props (`p`, `w`, `h`, `fz`) |

Do not measure in JS to write CSS variables or `style={{ left, top }}` and position absolutely. Allowed exceptions, each with a comment saying why at the place it is used: virtual list row positioning; dockview and xterm internals; badges and notification dots; drag handles and sliding knobs; exit copies of elements that are already gone (`design-system/motion/ghost`) and cross-fade layers that must overlap (`Crossfade`). A new exception needs the same comment.

When migrating a component, move spacing, alignment, sizing and typography from its stylesheet into layout props, then delete the CSS rules and class names nothing else uses (check `rg` across `web/` and `test/`: other files select some of them, for example `.tri-status`).

### File structure

`npm test` runs `scripts/verification/lint-structure.mjs`: at most 200 effective lines per source or test file, at most one exported function per file (`*-constants`, `*-schema`, `*-types` files and files that export only types are exempt), and no generic names (`utils`, `helpers`, `common`, `misc`, `lib`, `core`, `base`, `impl`, `manager`) as a whole name or trailing word of a file or directory (`session-manager.ts` fails; `base-name.ts` passes because `base` is part of a domain word). Existing violations sit in `scripts/verification/structure-allowlist/<scope>.txt` (`src`, `test`, `scripts`, `shared`, `web-<directory>`). Lists only shrink: delete the line when you fix a file, never add one. The check fails on a listed file that no longer violates.
