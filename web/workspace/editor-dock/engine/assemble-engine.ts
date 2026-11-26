import { panelsOf } from "./panels-of.ts";
import { panels } from "./panels.ts";
import { emitChange } from "./emit-change.ts";
import { activePath } from "./active-path.ts";
import { restore } from "./restore.ts";
import { listen } from "./listen.ts";
import { openFile } from "./open-file.ts";
import { findByPath } from "./find-by-path.ts";
import { paths } from "./paths.ts";
import { count } from "./count.ts";
import { openDiff } from "./open-diff.ts";
import { openPrompt } from "./open-prompt.ts";
import { close } from "./close.ts";
import { closePaths } from "./close-paths.ts";
import { renamePaths } from "./rename-paths.ts";
import { mergeGroups } from "./merge-groups.ts";
import { onChange } from "./on-change.ts";
import { onActivePath } from "./on-active-path.ts";
import { onPanelRemoved } from "./on-panel-removed.ts";
import { dispose } from "./dispose.ts";
import { openTerminal } from "./open-terminal.ts";
import { closeTerminal } from "./close-terminal.ts";
import { terminalNames } from "./terminal-names.ts";
import type { Engine, EngineContext, EngineHost } from "./engine-types.ts";

export function createEngine(api: EngineHost): Engine {
  const ctx: EngineContext = {
    api, subscriptions: [], changeListeners: new Set(), activeListeners: new Set(), removedListeners: new Set(),
    panelsOf: (component) => panelsOf(ctx, component),
    panels: () => panels(ctx),
    emitChange: () => emitChange(ctx),
    activePath: () => activePath(ctx),
    restore: (raw) => restore(ctx, raw),
    listen: () => listen(ctx),
    openFile: (path) => openFile(ctx, path),
    findByPath: (path) => findByPath(ctx, path),
    paths: () => paths(ctx),
    count: () => count(ctx),
    openDiff: (path) => openDiff(ctx, path),
    openPrompt: () => openPrompt(ctx),
    close: (id) => close(ctx, id),
    closePaths: (gone) => closePaths(ctx, gone),
    renamePaths: (from, to) => renamePaths(ctx, from, to),
    mergeGroups: () => mergeGroups(ctx),
    onChange: (listener) => onChange(ctx, listener),
    onActivePath: (listener) => onActivePath(ctx, listener),
    onPanelRemoved: (listener) => onPanelRemoved(ctx, listener),
    dispose: () => dispose(ctx),
    openTerminal: (name, focus) => openTerminal(ctx, name, focus),
    closeTerminal: (name) => closeTerminal(ctx, name),
    terminalNames: () => terminalNames(ctx),
  };
  return {
    restore: ctx.restore,
    listen: ctx.listen,
    openFile: ctx.openFile,
    findByPath: ctx.findByPath,
    paths: ctx.paths,
    count: ctx.count,
    openDiff: ctx.openDiff,
    openPrompt: ctx.openPrompt,
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
}
