
export function extensionUiRefreshKey(state) {
  return `${state.session.extensionUi?.revision || 0}:${state.session.transcriptRevision || 0}:${state.session.presentationRevision || 0}:${state.session.snapshot?.sequence || 0}:${state.session.snapshot?.operation?.operationId || ""}`;
}

