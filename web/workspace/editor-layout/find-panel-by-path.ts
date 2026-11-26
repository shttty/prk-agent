import type { PathPanel } from "./editor-layout-types.ts";

export const findPanelByPath = (panels: readonly PathPanel[], path: string) => panels.find((panel) => panel.path === path)?.id ?? null;
