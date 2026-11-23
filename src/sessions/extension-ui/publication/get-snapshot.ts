import type { UiContext, HostedExtensionUiSnapshot } from "../ui-types.ts";

export function snapshot(ctx: UiContext): HostedExtensionUiSnapshot {
    const prompts: Array<HostedExtensionUiSnapshot["prompts"][number]> = [...ctx.dialogs.values()].map((dialog) => ({
      id: dialog.id,
      kind: dialog.kind,
      title: dialog.title,
      ...(dialog.message === undefined ? {} : { message: dialog.message }),
      ...(dialog.placeholder === undefined ? {} : { placeholder: dialog.placeholder }),
      ...(dialog.prefill === undefined ? {} : { prefill: dialog.prefill }),
      ...(dialog.options === undefined ? {} : { options: dialog.options }),
      ...(dialog.expiresAt === undefined ? {} : { expiresAt: dialog.expiresAt }),
      ...dialog.ask,
    }));
    if (ctx.custom) {
      const options = typeof ctx.custom.options?.overlayOptions === "function" ? ctx.custom.primary?.options : ctx.custom.options?.overlayOptions;
      const { visible: _visible, ...geometry } = options ?? {};
      prompts.push({ id: ctx.custom.id, kind: "custom", ...(ctx.custom.overlay ? { overlay: geometry } : {}), hidden: ctx.custom.primary?.hidden ?? false, focused: ctx.custom.primary?.focused ?? !ctx.custom.overlay });
    }
    const positions = new Map<string, number>();
    let position = 0;
    for (const entry of ctx.session.sessionManager.buildSessionProjection().entries) {
      position += entry.messages.length;
      positions.set(entry.sourceEntry.id, position);
    }
    const displayAnchors = new Map<string, string | null>();
    if (ctx.state.notifications.length) {
      let afterEntryId: string | null = null;
      for (const entry of ctx.session.sessionManager.getBranch()) {
        if (entry.type === "message" || entry.type === "custom_message" || (entry.type === "branch_summary" && entry.summary)) afterEntryId = entry.id;
        displayAnchors.set(entry.id, afterEntryId);
      }
    }
    const notifications = ctx.state.notifications.flatMap(({ messageOffset, ...notification }) => {
      if (notification.sessionId !== ctx.session.sessionManager.getSessionId()) return [];
      const afterEntryId = notification.anchorEntryId === null ? null : displayAnchors.get(notification.anchorEntryId);
      const boundary = notification.anchorEntryId === null ? 0 : positions.get(notification.anchorEntryId);
      return afterEntryId === undefined ? [] : [{ ...notification, position: boundary === undefined ? 0 : boundary + messageOffset, afterEntryId, afterLive: messageOffset > 0 && boundary === position }];
    });
    return {
      revision: ctx.revision,
      autocomplete: ctx.autocompleteProviders.length > 0 || ctx.session.extensionRunner.getRegisteredCommands().length > 0,
      status: [...ctx.state.status].map(([key, text]) => ({ key, text })),
      notifications,
      working: { ...ctx.state.working },
      ...(ctx.state.hiddenThinkingLabel === undefined ? {} : { hiddenThinkingLabel: ctx.state.hiddenThinkingLabel }),
      ...(ctx.state.title === undefined ? {} : { title: ctx.state.title }),
      editor: { text: ctx.state.editorText, revision: ctx.state.editorRevision, ...(ctx.state.editorClientId === undefined ? {} : { clientId: ctx.state.editorClientId }) },
      toolsExpanded: ctx.state.toolsExpanded,
      widgets: [...ctx.state.widgets].map(([key, widget]) => ({ key, placement: widget.placement })),
      prompts,
    };
  }
