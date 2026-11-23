
export const layoutContext = (mobile, sessionRow, closed, status, filesOpen) => ({
    viewport: { width: window.innerWidth, height: window.innerHeight },
    devicePixelRatio: window.devicePixelRatio,
    breakpoint: mobile ? "phone" : "desktop",
    sessionId: sessionRow?.sessionId ?? null,
    session: !sessionRow ? "none" : closed ? "closed" : status === "sleeping" ? "sleeping" : "session",
    filesOpen,
    browser: navigator.userAgent,
});
