
export const findPanelByPath = (panels, path) => panels.find((panel) => panel.path === path)?.id ?? null;
