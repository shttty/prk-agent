import type { WorkbenchState } from "../../shell/page/page-types.ts";
import { useEffect } from "react";
import { useRef } from "react";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";

const RETRY_MS = 3000;

/**
 * Reloads a settings page that is waiting for the connection: once when the workbench link to the Gateway comes back,
 * and every few seconds while the link reports up but the page's own load still failed (an outage too short for the
 * link to notice).
 */
export function useRelink(onRelink: () => unknown, waiting = false) {
  const linked = useWorkbench((state: WorkbenchState) => state.workbenchLinked);
  const was = useRef(linked);
  const latest = useRef(onRelink);
  latest.current = onRelink;
  useEffect(() => {
    if (linked && !was.current) latest.current();
    was.current = linked;
  }, [linked]);
  useEffect(() => {
    if (!waiting || !linked) return undefined;
    const timer = setInterval(() => latest.current(), RETRY_MS);
    return () => clearInterval(timer);
  }, [waiting, linked]);
}
