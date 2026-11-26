import type { WorkbenchState } from "../../workbench/store/store-types.ts";

export const extensionUiInitializing = (state: WorkbenchState) => !state.session.snapshot || Boolean(state.session.extensionUi && !state.session.extensionUiRender);
