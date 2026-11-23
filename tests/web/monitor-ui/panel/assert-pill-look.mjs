import assert from "node:assert/strict";

/** The button is a special one, not a toolbar icon: accent text on a tinted capsule, tabular numbers. */
export const assertPillLook = (page, label) => page.evaluate(() => {
  const pill = document.querySelector("#toggle-monitor");
  const probe = document.createElement("i");
  probe.style.color = "var(--pi-accent-strong)";
  document.body.append(probe);
  const accent = getComputedStyle(probe).color;
  probe.remove();
  const style = getComputedStyle(pill);
  const number = getComputedStyle(pill.querySelector(".pi-monitor-pill-fact b"));
  return { color: style.color, accent, tinted: style.backgroundImage.includes("gradient"), border: style.borderTopWidth, tabular: number.fontVariantNumeric.includes("tabular-nums") };
}).then((look) => {
  assert.equal(look.color, look.accent, `${label}: accent text`);
  assert(look.tinted && look.border === "1px", `${label}: a tinted, outlined capsule`);
  assert.equal(look.tabular, true, `${label}: tabular numbers`);
});
