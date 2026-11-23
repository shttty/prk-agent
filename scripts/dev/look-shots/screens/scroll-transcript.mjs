export async function scrollTranscript(page, to = "bottom") {
  await page.evaluate((where) => { const el = document.querySelector("#transcript"); if (el) el.scrollTop = where === "bottom" ? el.scrollHeight : 0; }, to);
  await page.waitForTimeout(250);
}
