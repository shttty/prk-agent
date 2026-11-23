export const openSidebar = async (page) => { await page.locator("#open-sidebar").click(); await page.locator(".mobile-sidebar-body .management-sidebar").waitFor(); await page.waitForTimeout(350); };
