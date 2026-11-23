export function hasComposerDraft(text, attachments) {
  return Boolean(text.trim() || attachments.length);
}
