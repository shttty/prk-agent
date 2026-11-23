---
name: pi-remote-kernel-web
description: Use when changing or verifying the PRK Web workbench.
---

# PRK Web workbench

## Development and verification

- Use the checkout's own root and `web/` dependencies. The Vite dev command and API URL are in [README.md](../../../README.md#development); installation and startup are in [INSTALL.md](../../../INSTALL.md).
- For a browser check without a Gateway, use `node scripts/dev/look-shots.mjs --out /path/to/screenshots --screens main,chat` from the checkout. The script starts Vite, uses the workbench's mock API, and captures the real UI at desktop and phone widths in light and dark modes. Set Playwright and Chromium as in the [test environment](../../../docs/kernel-recovery.md#test-environment).
- Browser suites share `tests/fixtures/web-dev.mjs` and `tests/fixtures/workspace-mock.mjs`. If a test restarts its API, reuse its port so Vite's proxy target stays valid. Scope locators to stable IDs, `data-action`, or machine-readable `data-*` state; do not assert UI wording.
- Follow the [verification tiers](../../../AGENTS.md#验收与任务交接). Choose relevant integration coverage from the final diff; keep browser and external-process tests out of the unit suite.

## Implementation boundaries

- `web/` communicates with the backend only through same-origin `/api` HTTP, SSE and WebSocket routes. Frontend code does not import `src/`. Vite rewrites `Origin` only for requests from the page's own origin; preserve the backend's origin checks.
- Take conversation, session and tool availability from Gateway and SDK state. Do not add shadow user messages, deduplicate by text, or infer progress the backend does not report. Preserve narrow render dependencies; snapshots and terminal telemetry should not rerender unrelated conversation content.
- Use the design system and `--pi-*` tokens. Keep separate light and dark contrast checks and verify desktop and phone layouts. Put message actions on that message, session actions in its sidebar menu or detail panel, and reserve `/` for command input, skills and templates.
- User-facing notices state what happened and, if useful, one next action. Prefer existing alerts and status pills over duplicate notices. Keep the chat non-dockable and use the workspace for file and terminal panels.
- For SDK component and tool renderer semantics, read [Pi SDK references](../../../docs/pi-sdk/README.md). Cross-process interface changes follow [the contract](../../../docs/contract.md).
