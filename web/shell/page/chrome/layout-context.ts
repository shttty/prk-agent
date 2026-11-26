
import type { LayoutCodeContext } from "../../layout/layout-types.ts";
import type { SelectedRow } from "../../../workbench/store/store-types.ts";

export const layoutContext = (mobile: boolean, sessionRow: SelectedRow | undefined, closed: boolean, status: string | undefined, filesOpen: boolean): LayoutCodeContext => ({
    viewport: { width: window.innerWidth, height: window.innerHeight },
    devicePixelRatio: window.devicePixelRatio,
    breakpoint: mobile ? "phone" : "desktop",
    sessionId: sessionRow?.sessionId ?? null,
    session: !sessionRow ? "none" : closed ? "closed" : status === "sleeping" ? "sleeping" : "session",
    filesOpen,
    browser: navigator.userAgent,
});
