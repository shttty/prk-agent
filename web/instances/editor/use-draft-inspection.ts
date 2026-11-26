import { useEffect, useRef, useState } from "react";
import type { InspectTargetResult } from "../../../src/gateway/wire/web-types.ts";
import type { WorkbenchActions } from "../../sessions/workbench-actions-types.ts";
import { isAbsolutePath } from "../directory-picker/is-absolute-path.ts";
import { targetError } from "../target-errors/target-error.ts";
import { draftConnection } from "./draft-connection.ts";
import type { ConnectionProbe, DraftForm, DraftInspection, PythonCheck } from "./editor-types.ts";

/**
 * The draft's connection test and interpreter version check (both run from the target's `/`, independent of the
 * workspace cwd). Every result is keyed by the draft it was asked for and only the newest request writes, so a late
 * reply to an older draft or request never shows against the current one. They inform the user; saving does not
 * depend on them (the Gateway checks a complete changed configuration itself).
 */
export function useDraftInspection(actions: WorkbenchActions, form: DraftForm, onHostname: (hostname: string) => void): DraftInspection {
  const connection = draftConnection(form);
  const connectionKey = connection ? JSON.stringify(connection) : "";
  const python = form.python.trim();
  const pythonKey = `${connectionKey}\u0000${python}`;
  const [probe, setProbe] = useState<ConnectionProbe | null>(null);
  const [check, setCheck] = useState<PythonCheck | null>(null);
  const serials = useRef({ probe: 0, check: 0 });
  const latest = useRef({ connectionKey, pythonKey, mounted: true });
  latest.current.connectionKey = connectionKey;
  latest.current.pythonKey = pythonKey;
  useEffect(() => () => { latest.current.mounted = false; }, []);
  // Only the newest request writes; if its draft has moved on since, it drops its own pending state instead.
  const settleProbe = (serial: number, key: string, value: ConnectionProbe) => {
    if (!latest.current.mounted || serials.current.probe !== serial) return false;
    const fresh = latest.current.connectionKey === key;
    setProbe(fresh ? value : null);
    return fresh;
  };
  const settleCheck = (serial: number, key: string, value: PythonCheck) => {
    if (!latest.current.mounted || serials.current.check !== serial) return;
    setCheck(latest.current.pythonKey === key ? value : null);
  };

  async function checkPython(path: string) {
    if (!connection || !isAbsolutePath(path)) return;
    const key = `${connectionKey}\u0000${path}`;
    const serial = ++serials.current.check;
    setCheck({ key, status: "pending" });
    try {
      const result: InspectTargetResult = await actions.inspectTarget({ ...connection, python: path });
      if (!result.python) throw new Error("目标机没有返回解释器信息。");
      settleCheck(serial, key, { key, status: "success", path: result.python.path, version: result.python.version });
    } catch (cause) {
      settleCheck(serial, key, { key, status: "error", error: targetError(cause) });
    }
  }

  async function testConnection() {
    if (!connection) return;
    const key = connectionKey;
    const serial = ++serials.current.probe;
    setProbe({ key, status: "pending" });
    try {
      const result: InspectTargetResult = await actions.inspectTarget(connection);
      const candidates = result.pythonCandidates.filter((item) => isAbsolutePath(item));
      if (!settleProbe(serial, key, { key, status: "success", hostname: result.hostname, platform: result.platform, candidates })) return;
      onHostname(result.hostname.trim());
      // A chosen interpreter is checked again on the connection just proven.
      if (isAbsolutePath(python) && latest.current.pythonKey === pythonKey) void checkPython(python);
    } catch (cause) {
      settleProbe(serial, key, { key, status: "error", error: targetError(cause) });
    }
  }

  const probed = probe?.key === connectionKey ? probe : null;
  const checked = check?.key === pythonKey ? check : null;
  return { connection, probed, checked, testConnection, checkPython };
}
