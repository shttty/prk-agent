import { useAttachmentInput } from "./attachments/use-attachment-input.js";
export function useComposerAttachments(ctx) {
  const { attachments, limits, actions } = ctx;
  const attach = useAttachmentInput({ attachments, onChange: actions.setAttachments, limits });
  return { attach };
}
