
export function syncComposerText({ aui, composerText }) {
    if (aui.composer.getState().text !== composerText) aui.composer.setText(composerText);
  }
