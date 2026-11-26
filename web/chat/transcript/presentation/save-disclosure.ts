import type { ChatActions } from "../../thread/chat-actions-types.ts";
import type { Presentation } from "../../../workbench/session-storage/session-storage-types.ts";
export function saveDisclosure(actions: ChatActions | undefined, key: string, open: boolean) {
  actions?.savePresentation((presentation: Partial<Presentation> | null) => ({
    openedTools: [...(presentation?.openedTools ?? []).filter((value) => value !== key && value !== `!${key}`), open ? key : `!${key}`],
  }));
}
