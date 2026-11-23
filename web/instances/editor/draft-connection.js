/** The draft's connection as the Gateway takes it, or null while a remote draft has no command yet. The command goes exactly as typed. */
export function draftConnection(form) {
  if (form.local) return { local: true };
  return form.sshCommand.trim() ? { local: false, sshCommand: form.sshCommand } : null;
}
