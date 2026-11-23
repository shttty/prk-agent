/** Push a collection event the way the workbench stream does. */
export const push = (page, payload) => page.evaluate((value) => {
  const source = window.__eventSources.find((candidate) => candidate.url.endsWith("/sessions/events"));
  source.dispatchEvent(new MessageEvent("collection", { data: JSON.stringify(value) }));
}, payload);
