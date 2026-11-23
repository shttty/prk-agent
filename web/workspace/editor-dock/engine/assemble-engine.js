import { panelsOf } from "./panels-of.js";
import { panels } from "./panels.js";
import { emitChange } from "./emit-change.js";
import { activePath } from "./active-path.js";
import { restore } from "./restore.js";
import { listen } from "./listen.js";
import { openFile } from "./open-file.js";
import { findByPath } from "./find-by-path.js";
import { paths } from "./paths.js";
import { count } from "./count.js";
import { openDiff } from "./open-diff.js";
import { close } from "./close.js";
import { closePaths } from "./close-paths.js";
import { renamePaths } from "./rename-paths.js";
import { mergeGroups } from "./merge-groups.js";
import { onChange } from "./on-change.js";
import { onActivePath } from "./on-active-path.js";
import { onPanelRemoved } from "./on-panel-removed.js";
import { dispose } from "./dispose.js";
import { openTerminal } from "./open-terminal.js";
import { closeTerminal } from "./close-terminal.js";
import { terminalNames } from "./terminal-names.js";
export function createEngine(api) {
  const ctx = { api, subscriptions: [], changeListeners: new Set(), activeListeners: new Set(), removedListeners: new Set() };
  ctx.panelsOf = (...args) => panelsOf(ctx, ...args);
  ctx.panels = (...args) => panels(ctx, ...args);
  ctx.emitChange = (...args) => emitChange(ctx, ...args);
  ctx.activePath = (...args) => activePath(ctx, ...args);
  ctx.restore = (...args) => restore(ctx, ...args);
  ctx.listen = (...args) => listen(ctx, ...args);
  ctx.openFile = (...args) => openFile(ctx, ...args);
  ctx.findByPath = (...args) => findByPath(ctx, ...args);
  ctx.paths = (...args) => paths(ctx, ...args);
  ctx.count = (...args) => count(ctx, ...args);
  ctx.openDiff = (...args) => openDiff(ctx, ...args);
  ctx.close = (...args) => close(ctx, ...args);
  ctx.closePaths = (...args) => closePaths(ctx, ...args);
  ctx.renamePaths = (...args) => renamePaths(ctx, ...args);
  ctx.mergeGroups = (...args) => mergeGroups(ctx, ...args);
  ctx.onChange = (...args) => onChange(ctx, ...args);
  ctx.onActivePath = (...args) => onActivePath(ctx, ...args);
  ctx.onPanelRemoved = (...args) => onPanelRemoved(ctx, ...args);
  ctx.dispose = (...args) => dispose(ctx, ...args);
  ctx.openTerminal = (...args) => openTerminal(ctx, ...args);
  ctx.closeTerminal = (...args) => closeTerminal(ctx, ...args);
  ctx.terminalNames = (...args) => terminalNames(ctx, ...args);
  const engine = {
    restore: ctx.restore,
    listen: ctx.listen,
    openFile: ctx.openFile,
    findByPath: ctx.findByPath,
    paths: ctx.paths,
    count: ctx.count,
    openDiff: ctx.openDiff,
    activePath: ctx.activePath,
    close: ctx.close,
    closePaths: ctx.closePaths,
    renamePaths: ctx.renamePaths,
    mergeGroups: ctx.mergeGroups,
    onChange: ctx.onChange,
    onActivePath: ctx.onActivePath,
    onPanelRemoved: ctx.onPanelRemoved,
    dispose: ctx.dispose,
    openTerminal: ctx.openTerminal,
    closeTerminal: ctx.closeTerminal,
    terminalNames: ctx.terminalNames,
  };
  ctx.engine = engine;
  return engine;
}
