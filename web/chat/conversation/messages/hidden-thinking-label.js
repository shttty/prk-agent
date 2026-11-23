
export function hiddenThinkingLabel(state) {
  return state.session.extensionUi?.hiddenThinkingLabel ?? state.session.extensionUiRender?.hiddenThinkingLabel;
}
