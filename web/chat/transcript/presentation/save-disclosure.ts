import type { ChatActions } from "../../thread/chat-actions-types.ts";
import type { SavedPresentation } from "../presentation-types.ts";
export function saveDisclosure(actions: ChatActions | undefined, key: string, open: boolean) {
  actions?.savePresentation((presentation: Partial<SavedPresentation> | null) => ({
    openedTools: [...(presentation?.openedTools ?? []).filter((value) => value !== key && value !== `!${key}`), open ? key : `!${key}`],
  }));
}
