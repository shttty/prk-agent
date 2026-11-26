import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { WorkbenchActions } from "../../sessions/workbench-actions-types.ts";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import type { EnvironmentFailure, TargetEnvironment } from "./environment-types.ts";
import type { WorkbenchState } from "../../workbench/store/store-types.ts";

// This page's own reasons to stop waiting; the Gateway's own failures arrive as the snapshot's `error`.
const STOPPED = {
  "link-lost": "与 Gateway 的连接已断开，下发结果未确认。",
  restarted: "Gateway 已重启，下发已中断。",
  stopped: "下发已停止。",
};

type Intent = { streamId: string; revision: number; losses: number; onReady: () => void };
type Held = { streamId: string; revision: number };

/** The instance editor's wait on one instance's remote environment (docs/wire/targets.md, 实例环境下发). `start(onReady, target?)`
 * is one manual intent: POST the deploy (starting or joining the instance's one task), then call `onReady` once when that
 * stream reports ready. The intent ends without
 * `onReady` when the deploy fails, the Gateway stream changes (restart), the page loses its workbench stream, or the page
 * closes; only a new explicit `start` tries again. `target` defaults to `targetName` (the editor names a just-saved one). */
export function useEnvironmentGate(actions: WorkbenchActions, targetName: string) {
  const environment: TargetEnvironment | null = useWorkbench((state: WorkbenchState) => state.targets.find((target) => target.id === targetName)?.environment ?? null);
  const losses: number = useWorkbench((state: WorkbenchState) => state.workbenchLinkLosses);
  const linked: boolean = useWorkbench((state: WorkbenchState) => state.workbenchLinked);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [failure, setFailure] = useState<EnvironmentFailure | null>(null);
  const [posting, setPosting] = useState(false);
  const serial = useRef(0);
  useEffect(() => () => { serial.current += 1; }, []);
  const stop = (kind: keyof typeof STOPPED) => { setIntent(null); setFailure({ kind, message: STOPPED[kind] }); };
  // The POST answer may still show the state before the task (idle, or a previous task's ready/failed); only states after
  // it (higher revision) end the intent, except a ready answer itself, which lets the create run at once.
  const settle = useEffectEvent(() => {
    if (!intent || !environment) return;
    if (losses !== intent.losses) return stop("link-lost");
    if (environment.streamId !== intent.streamId) return stop("restarted");
    const settled = environment.settled;
    if (settled?.status === "ready" && settled.revision >= intent.revision) {
      setIntent(null);
      return void intent.onReady();
    }
    if (settled?.status === "failed" && settled.revision > intent.revision) {
      setIntent(null);
      return setFailure({ kind: "deploy", code: settled.error?.code, message: settled.error?.message || "远端环境下发失败。", details: settled.error?.details });
    }
    if (environment.status === "idle" && environment.revision > intent.revision) stop("stopped");
  });
  useEffect(() => { settle(); }, [intent, environment, losses]);

  async function start(onReady: () => void, target = targetName) {
    const run = ++serial.current;
    const startedUnder = losses;
    setIntent(null);
    setFailure(null);
    setPosting(true);
    try {
      const held: Held = await actions.deployEnvironment(target);
      if (run === serial.current) setIntent({ streamId: held.streamId, revision: held.revision, losses: startedUnder, onReady });
    } catch (cause) {
      if (run === serial.current) setFailure(requestFailure(cause));
    } finally {
      if (run === serial.current) setPosting(false);
    }
  }
  /** Watches a task the Gateway already started (an instance save deploys by itself) from the snapshot that reported it,
   * under the same stop rules, without another POST. */
  const watch = (held: Held) => {
    serial.current += 1;
    setFailure(null);
    setIntent({ streamId: held.streamId, revision: held.revision, losses, onReady: () => {} });
  };
  return { environment, failure, linked, waiting: posting || Boolean(intent), start, watch };
}

// A rejected deploy request: the Gateway's error carries `code` and `details`.
function requestFailure(cause: unknown): EnvironmentFailure {
  const field = (key: string): unknown => (typeof cause === "object" && cause !== null ? Reflect.get(cause, key) : undefined);
  const code = field("code");
  const details = field("details");
  return {
    kind: "request",
    ...(typeof code === "string" ? { code } : {}),
    message: cause instanceof Error ? cause.message : "下发请求失败。",
    ...(typeof details === "object" && details !== null ? { details: Object.fromEntries(Object.entries(details)) } : {}),
  };
}
