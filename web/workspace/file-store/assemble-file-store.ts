import { emit } from "./emit.ts";
import { patch } from "./patch.ts";
import { load } from "./load.ts";
import { ensure } from "./ensure.ts";
import { save } from "./save.ts";
import { subscribe } from "./subscribe.ts";
import { get } from "./get.ts";
import { markRestored } from "./mark-restored.ts";
import { edit } from "./edit.ts";
import { setView } from "./set-view.ts";
import { isDirtyPath } from "./is-dirty-path.ts";
import { dirtyUnder } from "./dirty-under.ts";
import { forget } from "./forget.ts";
import { remap } from "./remap.ts";
import { drop } from "./drop.ts";
import { reloadOpen } from "./reload-open.ts";
import { rebind } from "./rebind.ts";
import type { PageApi } from "../../shell/page/page-types.ts";
import type { FileStore, FileStoreContext } from "./file-store-types.ts";

export function createFileStore({ api, base, onGone }: { api: PageApi; base: string; onGone?: (path: string) => void }): FileStore {
  const ctx: FileStoreContext = {
    api, base, onGone, environment: null, epoch: 0, files: new Map(), listeners: new Set(), restored: new Set(),
    emit: () => emit(ctx),
    patch: (path, changes) => patch(ctx, path, changes),
    load: (path) => load(ctx, path),
    ensure: (path) => ensure(ctx, path),
    save: (path, force) => save(ctx, path, force),
    subscribe: (listener) => subscribe(ctx, listener),
    get: (path) => get(ctx, path),
    markRestored: (paths) => markRestored(ctx, paths),
    edit: (path, content) => edit(ctx, path, content),
    setView: (path, view) => setView(ctx, path, view),
    isDirty: (path) => isDirtyPath(ctx, path),
    dirtyUnder: (root) => dirtyUnder(ctx, root),
    forget: (path) => forget(ctx, path),
    remap: (from, to) => remap(ctx, from, to),
    drop: (root) => drop(ctx, root),
    reloadOpen: (paths) => reloadOpen(ctx, paths),
    rebind: (environment) => rebind(ctx, environment),
  };
  return {
    subscribe: ctx.subscribe, get: ctx.get, ensure: ctx.ensure, load: ctx.load, save: ctx.save, markRestored: ctx.markRestored, edit: ctx.edit,
    setView: ctx.setView, isDirty: ctx.isDirty, dirtyUnder: ctx.dirtyUnder, forget: ctx.forget, remap: ctx.remap, drop: ctx.drop, reloadOpen: ctx.reloadOpen, rebind: ctx.rebind,
  };
}
