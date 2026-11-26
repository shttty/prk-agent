export function hasComposerDraft(text: string, attachments: readonly unknown[]): boolean {
  return Boolean(text.trim() || attachments.length);
}
