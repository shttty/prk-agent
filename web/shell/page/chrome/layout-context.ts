
import type { ManagedSessionSnapshot } from "../../../../src/gateway/wire/web-types.ts";
import type { LayoutCodeContext } from "../../layout/layout-types.ts";

export const layoutContext = (mobile: boolean, sessionRow: ManagedSessionSnapshot | undefined, closed: boolean, status: string | undefined, filesOpen: boolean): LayoutCodeContext => ({
    viewport: { width: window.innerWidth, height: window.innerHeight },
    devicePixelRatio: window.devicePixelRatio,
    breakpoint: mobile ? "phone" : "desktop",
    sessionId: sessionRow?.sessionId ?? null,
    session: !sessionRow ? "none" : closed ? "closed" : status === "sleeping" ? "sleeping" : "session",
    filesOpen,
    browser: navigator.userAgent,
});
