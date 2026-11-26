import type { LAYOUT } from "./layout-constants.ts";

/** What 设置 → 复制布局码 records about the window and the session next to the saved layout. */
export type LayoutCodeContext = {
  viewport: { width: number; height: number };
  devicePixelRatio: number;
  breakpoint: "phone" | "desktop";
  sessionId: string | null;
  session: "none" | "closed" | "sleeping" | "session";
  filesOpen: boolean;
  browser: string;
};

/** The saved chrome values, by name. */
export type LayoutValues = typeof LAYOUT;

/** The live layout state: the saved values plus a counter that moves when "重置布局" ran. */
export type LayoutState = LayoutValues & { resets: number };
