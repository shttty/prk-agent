import type { NativeTarget, StaticCommand } from "../native-types.ts";
import { wakesSleepingSession } from "./wakes-sleeping-session.ts";

export function commandAvailability(command: StaticCommand, target: NativeTarget): { readonly enabled: boolean; readonly reason?: string } {
  if (command.name === "fork") return { enabled: false, reason: "Use the fork icon below an assistant reply; Web does not expose a /fork command." };
  if (command.name === "name") return target.rename ? { enabled: true } : { enabled: false, reason: "Gateway session rename is unavailable." };
  if (command.name === "new" && !(target.state === "sleeping" || (target.state === "closed" && target.readOnly))
    && (target.readOnly || target.state !== "idle" || !target.session
    || !target.session.isIdle || target.session.isCompacting || target.session.pendingMessageCount > 0
    || target.host?.isIdle === false)) {
    return { enabled: false, reason: "Creating a session requires an idle source session." };
  }
  if (["trust", "login", "logout", "share", "debug", "import", "llama"].includes(command.name)) {
    const reason = command.name === "llama"
      ? "The native llama extension is not loaded in this runtime; model download/process effects remain disabled."
      : "This sensitive external side effect requires a dedicated authorized flow and is not executed from chat.";
    return { enabled: false, reason };
  }
  if (!target.readOnly && target.state === "sleeping"
    && (wakesSleepingSession(command.name) || ["model", "thinking", "scoped-models"].includes(command.name))) return { enabled: true };
  if (target.readOnly || target.state === "sleeping") {
    if (command.name === "new" || command.name === "clone" || command.name === "fork-reply") return { enabled: true };
    if (command.name === "export") return { enabled: false, reason: "Native SDK export requires an active session; read-only history export is unsupported." };
    return command.effect === "read" || command.effect === "presentation"
      ? { enabled: true }
      : { enabled: false, reason: target.state === "sleeping" ? "This operation requires an awake session." : "This session is read-only history; select or create an active Gateway session before changing it." };
  }
  if (command.name === "compact") return { enabled: true };
  if (command.name === "reload") {
    if (!target.session || !target.host) return { enabled: false, reason: "Reload requires an active SDK runtime." };
    const kernel = target.host.getSnapshot().kernel;
    if (!target.session.isIdle || target.session.isCompacting || target.session.pendingMessageCount > 0
      || target.host.isIdle === false || kernel?.state === "busy" || kernel?.state === "starting") {
      return { enabled: false, reason: "Session must be idle to reload tools and skills." };
    }
  }
  if (command.name === "model" || command.name === "thinking") {
    return target.session ? { enabled: true } : { enabled: false, reason: "No active SDK session." };
  }
  if (target.state !== "idle" && command.effect !== "read" && command.effect !== "presentation") return { enabled: false, reason: `Session is ${target.state}; wait for idle before changing model, context, settings, or identity.` };
  return { enabled: true };
}
