export async function layoutRootsDuringComposition(cdp, compose, terminal) {
  const events = [];
  const collect = ({ value }) => events.push(...value);
  await cdp.send("DOM.enable");
  cdp.on("Tracing.dataCollected", collect);
  await cdp.send("Tracing.start", { categories: "devtools.timeline,disabled-by-default-devtools.timeline" });
  try { await compose(); }
  finally {
    const complete = new Promise((resolve) => cdp.once("Tracing.tracingComplete", resolve));
    await cdp.send("Tracing.end");
    await complete;
    cdp.off("Tracing.dataCollected", collect);
  }
  const dispatch = events.filter((event) => event.name === "EventDispatch" && event.ph === "X" && event.args.data?.type === "compositionupdate");
  const roots = new Set(events.filter((event) => event.name === "Layout" && event.ph === "X" &&
    dispatch.some((frame) => frame.tid === event.tid && frame.pid === event.pid && frame.ts <= event.ts && frame.ts + frame.dur >= event.ts + event.dur))
    .flatMap((event) => event.args.endData?.layoutRoots?.map(({ nodeId }) => nodeId) ?? []));
  try {
    return await Promise.all([...roots].map(async (backendNodeId) => {
      const { object: { objectId } } = await cdp.send("DOM.resolveNode", { backendNodeId, objectGroup: "ime-layout" });
      const { result } = await cdp.send("Runtime.callFunctionOn", { objectId, returnByValue: true,
        functionDeclaration: "function (selector) { return !!this.closest?.(selector); }", arguments: [{ value: terminal }] });
      return result.value;
    }));
  } finally { await cdp.send("Runtime.releaseObjectGroup", { objectGroup: "ime-layout" }); }
}
