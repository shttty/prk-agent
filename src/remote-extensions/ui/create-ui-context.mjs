import { dialog } from "./dialogs/request-ui-dialog.mjs";
import { editor } from "./dialogs/request-editor.mjs";
import { notify } from "./updates/notify.mjs";
import { setStatus } from "./updates/set-status.mjs";
import { setTitle } from "./updates/set-title.mjs";
import { setWidget } from "./updates/set-widget.mjs";
import { setEditorText } from "./editor/set-editor-text.mjs";
import { pasteToEditor } from "./editor/paste-editor-text.mjs";
import { readTheme } from "./read-theme.mjs";
import { noop, emptyListener, emptyDialog, emptyThemes, failedThemeSwitch } from "./warn-ui-capability.mjs";

export function uiContext(ctx, owner, operation) {
  const members = {
    select: dialog.bind(undefined, ctx, owner, operation, "select", undefined),
    confirm: dialog.bind(undefined, ctx, owner, operation, "confirm", false),
    input: dialog.bind(undefined, ctx, owner, operation, "input", undefined),
    editor: editor.bind(undefined, ctx, owner, operation),
    notify: notify.bind(undefined, ctx, owner, operation),
    setStatus: setStatus.bind(undefined, ctx, owner, operation),
    setTitle: setTitle.bind(undefined, ctx, owner, operation),
    setEditorText: setEditorText.bind(undefined, ctx, owner, operation),
    pasteToEditor: pasteToEditor.bind(undefined, ctx, owner, operation),
    setWidget: setWidget.bind(undefined, ctx, owner, operation),
    onTerminalInput: noop.bind(undefined, ctx, owner, "onTerminalInput", emptyListener),
    setWorkingMessage: noop.bind(undefined, ctx, owner, "setWorkingMessage", undefined),
    setWorkingVisible: noop.bind(undefined, ctx, owner, "setWorkingVisible", undefined),
    setWorkingIndicator: noop.bind(undefined, ctx, owner, "setWorkingIndicator", undefined),
    setHiddenThinkingLabel: noop.bind(undefined, ctx, owner, "setHiddenThinkingLabel", undefined),
    setFooter: noop.bind(undefined, ctx, owner, "setFooter", undefined),
    setHeader: noop.bind(undefined, ctx, owner, "setHeader", undefined),
    custom: noop.bind(undefined, ctx, owner, "custom", emptyDialog),
    getEditorText: noop.bind(undefined, ctx, owner, "getEditorText", ""),
    addAutocompleteProvider: noop.bind(undefined, ctx, owner, "addAutocompleteProvider", undefined),
    setEditorComponent: noop.bind(undefined, ctx, owner, "setEditorComponent", undefined),
    getEditorComponent: noop.bind(undefined, ctx, owner, "getEditorComponent", undefined),
    getAllThemes: noop.bind(undefined, ctx, owner, "getAllThemes", emptyThemes),
    getTheme: noop.bind(undefined, ctx, owner, "getTheme", undefined),
    setTheme: noop.bind(undefined, ctx, owner, "setTheme", failedThemeSwitch),
    getToolsExpanded: noop.bind(undefined, ctx, owner, "getToolsExpanded", false),
    setToolsExpanded: noop.bind(undefined, ctx, owner, "setToolsExpanded", undefined),
    get theme() { return readTheme(ctx, owner); },
  };
  if (operation.command) {
    for (const key of ["onTerminalInput", "setWorkingMessage", "setWorkingVisible", "setWorkingIndicator", "setHiddenThinkingLabel", "setFooter", "setHeader", "custom", "getEditorText", "addAutocompleteProvider", "setEditorComponent", "getEditorComponent", "getAllThemes", "getTheme", "setTheme", "getToolsExpanded", "setToolsExpanded"]) delete members[key];
  }
  return ctx.facade(owner, "ui", members);
}
