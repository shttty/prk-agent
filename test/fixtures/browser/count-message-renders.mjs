// React DevTools commits expose PerformedWork even when a render leaves the DOM unchanged.
export async function installMessageRenderCounter(page) {
  await page.addInitScript(() => {
    let prior = new Set(), commits = [];
    const names = new Set(["MessageView", "MessageActions", "Composer", "ComposerDock"]);
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      supportsFiber: true,
      renderers: new Map(),
      inject() { return 1; },
      onCommitFiberUnmount() {},
      onCommitFiberRoot(_id, root) {
        const seen = new Set(), counts = {};
        const walk = (fiber) => {
          for (let node = fiber; node; node = node.sibling) {
            const name = node.type?.name ?? node.type?.type?.name;
            if (names.has(name)) {
              seen.add(node);
              if (!prior.has(node) && (node.flags & 1)) counts[name] = (counts[name] ?? 0) + 1;
            }
            if (node.child) walk(node.child);
          }
        };
        walk(root.current);
        prior = seen;
        if (Object.keys(counts).length) commits.push(counts);
      },
    };
    window.__messageRenders = { read: () => commits, reset: () => { commits = []; } };
  });
}
