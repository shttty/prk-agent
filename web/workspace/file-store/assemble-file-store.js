import { emit } from "./emit.js";
import { patch } from "./patch.js";
import { load } from "./load.js";
import { ensure } from "./ensure.js";
import { save } from "./save.js";
import { subscribe } from "./subscribe.js";
import { get } from "./get.js";
import { markRestored } from "./mark-restored.js";
import { edit } from "./edit.js";
import { setView } from "./set-view.js";
import { isDirtyPath } from "./is-dirty.js";
import { dirtyUnder } from "./dirty-under.js";
import { forget } from "./forget.js";
import { remap } from "./remap.js";
import { drop } from "./drop.js";
import { reloadOpen } from "./reload-open.js";
import { rebind } from "./rebind.js";
export function createFileStore({ api, base, onGone }) {
  const ctx = { api, base, onGone, environment: null, epoch: 0, files: new Map(), listeners: new Set(), restored: new Set() };
  ctx.emit = (...args) => emit(ctx, ...args);
  ctx.patch = (...args) => patch(ctx, ...args);
  ctx.load = (...args) => load(ctx, ...args);
  ctx.ensure = (...args) => ensure(ctx, ...args);
  ctx.save = (...args) => save(ctx, ...args);
  ctx.subscribe = (...args) => subscribe(ctx, ...args);
  ctx.get = (...args) => get(ctx, ...args);
  ctx.markRestored = (...args) => markRestored(ctx, ...args);
  ctx.edit = (...args) => edit(ctx, ...args);
  ctx.setView = (...args) => setView(ctx, ...args);
  ctx.isDirty = (...args) => isDirtyPath(ctx, ...args);
  ctx.dirtyUnder = (...args) => dirtyUnder(ctx, ...args);
  ctx.forget = (...args) => forget(ctx, ...args);
  ctx.remap = (...args) => remap(ctx, ...args);
  ctx.drop = (...args) => drop(ctx, ...args);
  ctx.reloadOpen = (...args) => reloadOpen(ctx, ...args);
  ctx.rebind = (...args) => rebind(ctx, ...args);
  const store = {
    subscribe: ctx.subscribe,
    get: ctx.get,
    ensure: ctx.ensure,
    load: ctx.load,
    save: ctx.save,
    markRestored: ctx.markRestored,
    edit: ctx.edit,
    setView: ctx.setView,
    isDirty: ctx.isDirty,
    dirtyUnder: ctx.dirtyUnder,
    forget: ctx.forget,
    remap: ctx.remap,
    drop: ctx.drop,
    reloadOpen: ctx.reloadOpen,
    rebind: ctx.rebind,
  };
  return store;
}
