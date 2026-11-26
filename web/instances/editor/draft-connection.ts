import type { DraftForm } from "./editor-types.ts";

/** The draft's connection as the Gateway takes it, or null while a remote draft has no command yet. The command goes exactly as typed. */
export function draftConnection(form: Pick<DraftForm, "local" | "sshCommand">) {
  if (form.local) return { local: true } as const;
  return form.sshCommand.trim() ? { local: false, sshCommand: form.sshCommand } as const : null;
}
