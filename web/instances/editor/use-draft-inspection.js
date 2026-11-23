import { useEffect } from "react";
import { useRef } from "react";
import { useState } from "react";
import { draftConnection } from "./draft-connection.js";
import { targetError } from "../target-errors/target-error.js";
import { isAbsolutePath } from "../directory-picker/is-absolute-path.js";
/**
 * The draft's connection test and interpreter version check (both run from the target's `/`, independent of the
 * workspace cwd). Every result is keyed by the draft it was asked for and only the newest request writes, so a late
 * reply to an older draft or request never shows against the current one. They inform the user; saving does not
 * depend on them (the Gateway checks a complete changed configuration itself).
 */
export function useDraftInspection(actions, form, onHostname) {
  const connection = draftConnection(form);
  const connectionKey = connection ? JSON.stringify(connection) : "";
  const python = form.python.trim();
  const pythonKey = `${connectionKey}\u0000${python}`;
  const [probe, setProbe] = useState(null);
  const [check, setCheck] = useState(null);
  const serials = useRef({ probe: 0, check: 0 });
  const latest = useRef({ connectionKey, pythonKey, mounted: true });
  latest.current.connectionKey = connectionKey;
  latest.current.pythonKey = pythonKey;
  useEffect(() => () => { latest.current.mounted = false; }, []);
  // Only the newest request writes; if its draft has moved on since, it drops its own pending state instead.
  const settle = (kind, serial, key, value) => {
    if (!latest.current.mounted || serials.current[kind] !== serial) return false;
    const fresh = latest.current[kind === "probe" ? "connectionKey" : "pythonKey"] === key;
    (kind === "probe" ? setProbe : setCheck)(fresh ? value : null);
    return fresh;
  };

  async function checkPython(path) {
    if (!connection || !isAbsolutePath(path)) return;
    const key = `${connectionKey}\u0000${path}`;
    const serial = ++serials.current.check;
    setCheck({ key, status: "pending" });
    try {
      const result = await actions.inspectTarget({ ...connection, python: path });
      settle("check", serial, key, { key, status: "success", path: result.python.path, version: result.python.version });
    } catch (cause) {
      settle("check", serial, key, { key, status: "error", error: targetError(cause) });
    }
  }

  async function testConnection() {
    if (!connection) return;
    const key = connectionKey;
    const serial = ++serials.current.probe;
    setProbe({ key, status: "pending" });
    try {
      const result = await actions.inspectTarget(connection);
      const candidates = result.pythonCandidates.filter((item) => typeof item === "string" && isAbsolutePath(item));
      if (!settle("probe", serial, key, { key, status: "success", hostname: result.hostname, platform: typeof result.platform === "string" ? result.platform : "", candidates })) return;
      onHostname(result.hostname.trim());
      // A chosen interpreter is checked again on the connection just proven.
      if (isAbsolutePath(python) && latest.current.pythonKey === pythonKey) void checkPython(python);
    } catch (cause) {
      settle("probe", serial, key, { key, status: "error", error: targetError(cause) });
    }
  }

  const probed = probe?.key === connectionKey ? probe : null;
  const checked = check?.key === pythonKey ? check : null;
  return { connection, probed, checked, testConnection, checkPython };
}
