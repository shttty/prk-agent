import type { FormEvent } from "react";

export function submitDraft({ sendDraft }: { sendDraft: () => void }, event: FormEvent) {
    event.preventDefault();
    sendDraft();
  }
