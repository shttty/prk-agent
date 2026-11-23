
export const panelsOf = (ctx, component) => ctx.api.panels.filter((panel) => panel.api.component === component).map((panel) => ({ id: panel.id, path: panel.params?.path }));
