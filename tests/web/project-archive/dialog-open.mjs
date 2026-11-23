// Mantine's zero-size modal root identifies the open dialog through data-kind.
export const dialogOpen = (page, kind) => page.locator(`#management-dialog[data-kind="${kind}"]`).waitFor({ state: "attached" });
