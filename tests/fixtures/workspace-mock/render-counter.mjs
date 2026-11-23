// Test-only React render counter. Installs a minimal React DevTools global hook before the page loads (the dev
// build reports every commit to it; Vite's React Refresh wraps it and still calls through). A component fiber counts
// as rendered in a commit when it is not the object kept from the previous commit (skipped subtrees keep theirs) and
// carries React's PerformedWork flag (bailout clones reset it). A render counts to its innermost scope only: a region
// component listed in REGIONS (`app`, `sidebar`, `chat`, `composer`, ...) or `message:<id>` for each MessageView, so
// `chat` means the chat column outside its composer and messages. `aui-runtime` is assistant-ui's own provider
// machinery between Chat and ChatSurface (it holds the composer text, so it re-renders on keystrokes; upstream).
// `readCommits` returns the same counts per commit, to separate renders caused by a store update from a region's own
// timers (the monitor ticks every second). `readMountedComponents(page, names)` lists, per message, how many
// components with one of these display names exist after the last commit.
const REGIONS = { App: "app", Sidebar: "sidebar", Topbar: "topbar", MonitorPanel: "monitor", Chat: "chat", AssistantProviderInner: "aui-runtime", ChatSurface: "chat", AskAlert: "ask-alert", ComposerDock: "composer", Composer: "composer", ComposerMeta: "composer-meta", SettingsDialog: "settings" };
export async function installRenderCounter(page) {
  await page.addInitScript((REGIONS) => {
    const COMPONENT_TAGS = new Set([0, 1, 11, 14, 15]);
    const PERFORMED_WORK = 1;
    const counts = new Map();
    let commits = [];
    let commit = null;
    let mounted = [];
    let previous = new Set();
    const nameOf = (fiber) => fiber.type?.name || fiber.type?.type?.name || fiber.type?.render?.name || "";
    const scopeOf = (fiber) => {
      const name = nameOf(fiber);
      if (name === "MessageView" && fiber.memoizedProps?.message) return `message:${fiber.memoizedProps.message.id}`;
      return REGIONS[name] ?? null;
    };
    const walk = (fiber, scopes, seen, census) => {
      for (let node = fiber; node; node = node.sibling) {
        const scope = COMPONENT_TAGS.has(node.tag) ? scopeOf(node) : null;
        // A region re-entered below another one (ChatSurface `chat` under assistant-ui's `aui-runtime`) is innermost again.
        const inner = scope && scopes.at(-1) !== scope ? [...scopes, scope] : scopes;
        if (inner.length && COMPONENT_TAGS.has(node.tag)) {
          seen.add(node);
          const key = inner.at(-1);
          if (!previous.has(node) && (node.flags & PERFORMED_WORK)) { counts.set(key, (counts.get(key) || 0) + 1); commit[key] = (commit[key] || 0) + 1; }
          const message = inner.findLast((key) => key.startsWith("message:"));
          const name = node.type?.displayName || nameOf(node);
          if (message && name) census.push([message, name]);
        }
        if (node.child) walk(node.child, inner, seen, census);
      }
    };
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      supportsFiber: true, isDisabled: false, renderers: new Map(),
      inject() { return 1; }, checkDCE() {}, onScheduleFiberRoot() {}, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {},
      onCommitFiberRoot(_id, root) {
        const seen = new Set(); const census = []; commit = {};
        walk(root.current, [], seen, census);
        previous = seen; mounted = census;
        if (Object.keys(commit).length) commits.push(commit);
      },
    };
    window.__renderCounts = {
      reset: () => { counts.clear(); commits = []; },
      read: () => Object.fromEntries(counts),
      commits: () => commits,
      mounted: (names) => {
        const result = {};
        for (const [message, name] of mounted) if (names.includes(name)) result[message] = (result[message] || 0) + 1;
        return result;
      },
    };
  }, REGIONS);
}

export const resetRenderCounts = (page) => page.evaluate(() => window.__renderCounts.reset());
export const readRenderCounts = (page) => page.evaluate(() => window.__renderCounts.read());
/** Per-commit counts since the last reset (same scopes as readRenderCounts). */
export const readCommits = (page) => page.evaluate(() => window.__renderCounts.commits());
export const readMountedComponents = (page, names) => page.evaluate((names) => window.__renderCounts.mounted(names), names);
/** Total of the counts whose scope matches `test` (e.g. every message: `(scope) => scope.startsWith("message:")`). */
export const sumCounts = (counts, test) => Object.entries(counts).reduce((total, [scope, count]) => total + (test(scope) ? count : 0), 0);
