import { useAttachmentInput } from "./attachments/use-attachment-input.ts";
import type { ChatActions } from "../thread/chat-actions-types.ts";
import type { AttachmentLimits, StoredAttachment } from "./composer-types.ts";
export function useComposerAttachments({ attachments, limits, actions }: { attachments: StoredAttachment[]; limits: AttachmentLimits | undefined; actions: ChatActions }) {
  const attach = useAttachmentInput({ attachments, onChange: actions.setAttachments, limits });
  return { attach };
}
