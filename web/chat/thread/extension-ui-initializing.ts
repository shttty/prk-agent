import type { ChatState } from "./chat-state-types.ts";

export const extensionUiInitializing = (state: ChatState) => !state.session.snapshot || Boolean(state.session.extensionUi && !state.session.extensionUiRender);
