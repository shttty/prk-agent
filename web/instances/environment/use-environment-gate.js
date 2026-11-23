import { useState } from "react";
import { useRef } from "react";
import { useEffect } from "react";
import { useEffectEvent } from "react";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
// This page's own reasons to stop waiting; the Gateway's own failures arrive as the snapshot's `error`.
const STOPPED = {
  "link-lost": "与 Gateway 的连接已断开，下发结果未确认。",
  restarted: "Gateway 已重启，下发已中断。",
  stopped: "下发已停止。",
};

/** A page's wait on one instance's remote environment (docs/wire/targets.md, 实例环境下发). `start(onReady, target?)` is
 * one explicit intent: POST the deploy (starting or joining the instance's one task), then call `onReady` once when that
 * stream reports ready (the create dialog creates there; the instance editor only watches). The intent ends without
 * `onReady` when the deploy fails, the Gateway stream changes (restart), the page loses its workbench stream, or the page
 * closes; only a new explicit `start` tries again. `target` defaults to `targetName` (the editor names a just-saved one). */
export function useEnvironmentGate(actions, targetName) {
  const environment = useWorkbench((state) => state.targets.find((target) => target.id === targetName)?.environment ?? null);
  const losses = useWorkbench((state) => state.workbenchLinkLosses);
  const linked = useWorkbench((state) => state.workbenchLinked);
  const [intent, setIntent] = useState(null);
  const [failure, setFailure] = useState(null);
  const [posting, setPosting] = useState(false);
  const serial = useRef(0);
  useEffect(() => () => { serial.current += 1; }, []);
  const stop = (kind) => { setIntent(null); setFailure({ kind, message: STOPPED[kind] }); };
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

  async function start(onReady, target = targetName) {
    const run = ++serial.current;
    const startedUnder = losses;
    setIntent(null);
    setFailure(null);
    setPosting(true);
    try {
      const held = await actions.deployEnvironment(target);
      if (run === serial.current) setIntent({ streamId: held.streamId, revision: held.revision, losses: startedUnder, onReady });
    } catch (cause) {
      if (run === serial.current) setFailure({ kind: "request", code: cause?.code, message: cause instanceof Error ? cause.message : "下发请求失败。", details: cause?.details });
    } finally {
      if (run === serial.current) setPosting(false);
    }
  }
  /** Watches a task the Gateway already started (an instance save deploys by itself) from the snapshot that reported it,
   * under the same stop rules, without another POST. */
  const watch = (held) => {
    serial.current += 1;
    setFailure(null);
    setIntent({ streamId: held.streamId, revision: held.revision, losses, onReady: () => {} });
  };
  /** A create refused with ENVIRONMENT_REQUIRED: nothing was created; shown with the same explicit retry. */
  const refuse = (cause) => setFailure({ kind: "required", code: cause.code, message: cause.message, details: cause.details });
  return { environment, failure, linked, waiting: posting || Boolean(intent), start, watch, refuse };
}
