/** Every id on the page appears once. */
export async function assertUniqueIds(page, step) {
  const duplicated = await page.evaluate(() => { const ids = [...document.querySelectorAll("[id]")].map((node) => node.id); return [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))]; });
  if (duplicated.length) throw new Error(`duplicate ids after ${step}: ${duplicated.join(", ")}`);
}