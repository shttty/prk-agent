import { join } from "node:path";

export function rewriteSidecars(inventory, identities, issues) {
  const changes = [];
  const parse = (file) => {
    if (file === undefined) return undefined;
    try { return JSON.parse(file.text); }
    catch (error) { issues.push(`${file.path}: invalid JSON: ${error.message}`); return undefined; }
  };
  const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  const change = (file, value, destination = file.path) => {
    const text = `${JSON.stringify(value, null, 2)}\n`;
    if (destination !== file.path || JSON.stringify(value) !== JSON.stringify(parse(file))) {
      changes.push({ source: file.path, destination, text, original: file.text });
    }
  };
  const terminals = inventory.sidecars.terminals;
  const bindings = parse(terminals);
  if (bindings !== undefined) {
    if (!Array.isArray(bindings)) issues.push(`${terminals.path}: expected terminal bindings array`);
    else change(terminals, bindings.map((binding, index) => {
      const location = `${terminals.path}[${index}]`;
      if (!object(binding)) { issues.push(`${location}: expected terminal binding object`); return binding; }
      if (Object.hasOwn(binding, "worker") && Object.hasOwn(binding, "sessionId")) issues.push(`${location}: conflicting worker and sessionId fields`);
      const { worker, ...next } = binding;
      next.sessionId = Object.hasOwn(binding, "worker")
        ? identities.route(worker, `${location}/worker`)
        : identities.native(binding.sessionId, `${location}/sessionId`);
      return next;
    }));
  }
  const control = inventory.sidecars.control;
  const roles = parse(control);
  if (roles !== undefined) {
    if (!object(roles) || !Object.hasOwn(roles, "rootSessionId") || !object(roles.supervisors)) issues.push(`${control.path}: expected rootSessionId and supervisors object`);
    else change(control, {
      ...roles,
      rootSessionId: roles.rootSessionId === null ? null : identities.native(roles.rootSessionId, `${control.path}/rootSessionId`),
      supervisors: Object.fromEntries(Object.entries(roles.supervisors).map(([project, id]) => [project, identities.native(id, `${control.path}/supervisors/${project}`)])),
    });
  }
  const oldSelection = inventory.sidecars.currentWorker;
  const newSelection = inventory.sidecars.currentSession;
  const saved = parse(oldSelection);
  if (saved !== undefined) {
    if (!object(saved) || Object.keys(saved).length !== 2 || !Object.hasOwn(saved, "name") || !Object.hasOwn(saved, "sessionId")) {
      issues.push(`${oldSelection.path}: expected exactly {name,sessionId}`);
    } else {
      const route = identities.route(saved.name, `${oldSelection.path}/name`);
      const id = identities.native(saved.sessionId, `${oldSelection.path}/sessionId`);
      if (route !== undefined && id !== undefined && route !== id) issues.push(`${oldSelection.path}: name maps to ${JSON.stringify(route)} but saved sessionId is ${JSON.stringify(id)}`);
      change(oldSelection, { sessionId: id }, join(inventory.qqState, "current-session.json"));
    }
    if (newSelection !== undefined) issues.push(`${oldSelection.path}: destination already exists: ${newSelection.path}`);
  }
  const current = parse(newSelection);
  if (current !== undefined) {
    if (!object(current) || Object.keys(current).length !== 1 || !Object.hasOwn(current, "sessionId")) issues.push(`${newSelection.path}: expected exactly {sessionId}`);
    else identities.native(current.sessionId, `${newSelection.path}/sessionId`);
  }
  return changes;
}
