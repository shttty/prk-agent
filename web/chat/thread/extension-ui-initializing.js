
export const extensionUiInitializing = (state) => !state.session.snapshot || Boolean(state.session.extensionUi && !state.session.extensionUiRender);
