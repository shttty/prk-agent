import type { ExecutionTarget } from "../../config/execution-target/target-types.ts";
import { DEFAULT_LIMITS_OPTIONS } from "../../config/limits/limits-options.ts";
import { createSessionRuntime } from "../runtime/assemble-runtime.ts";
import type { SessionLifecycleListener } from "./collection-types.ts";
import type { SessionCollectionOptions } from "./collection-types.ts";
import type { SessionCollection } from "./collection-types.ts";
import { validateTargets } from "./targets/validate-targets.ts";
import type { SessionRecord } from "./collection-types.ts";
import { snapshot } from "./records/get-snapshot.ts";
import { replaceTargets } from "./targets/replace-targets.ts";
import { previewTargets } from "./targets/preview-targets.ts";
import { get } from "./records/get.ts";
import { create } from "./lifecycle/create-session.ts";
import { reset } from "./lifecycle/reset.ts";
import { reload } from "./lifecycle/reload.ts";
import { subscribe } from "./subscriptions/subscribe.ts";
import { closeSession } from "./lifecycle/close-session.ts";
import { forget } from "./records/forget.ts";
import { close } from "./lifecycle/close.ts";
import type { CollectionContext } from "./collection-state.ts";

/** Create the retained collection; dependencies resolve only when a session starts. */
export function createSessionCollection(targets: readonly ExecutionTarget[], options: SessionCollectionOptions): SessionCollection {
  const limits = options.limits ?? DEFAULT_LIMITS_OPTIONS;
  const configured = validateTargets(targets);
  const sessionFactory = options.sessionFactory ?? createSessionRuntime;
  const records = new Map<string, SessionRecord>();
  const ctx: CollectionContext = { options, limits, configured, sessionFactory, records, listeners: new Set<SessionLifecycleListener>(), closed: false, closing: undefined };
  const snapshotView = snapshot.bind(undefined, ctx);
  return {
    list: snapshotView,
    snapshot: snapshotView,
    previewTargets: previewTargets.bind(undefined, ctx),
    replaceTargets: replaceTargets.bind(undefined, ctx),
    get: get.bind(undefined, ctx),
    create: create.bind(undefined, ctx),
    reset: reset.bind(undefined, ctx),
    reload: reload.bind(undefined, ctx),
    subscribe: subscribe.bind(undefined, ctx),
    closeSession: closeSession.bind(undefined, ctx),
    forget: forget.bind(undefined, ctx),
    close: close.bind(undefined, ctx),
  };
}
