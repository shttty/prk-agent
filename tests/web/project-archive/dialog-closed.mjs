export const dialogClosed = (page) => page.locator("#management-dialog[data-kind]").waitFor({ state: "detached" });
