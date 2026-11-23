import assert from "node:assert/strict";

// Toggles a plugin row's enable switch the way a user does: an ordinary click on the visible pill track. Mantine renders
// the switch as a <label> holding a transparent input under that track (`.prk-pill-track` is the theme's track class),
// so the label activates the input. The switch must be usable (list idle) before the click. Returns the prior state.
export async function clickPluginSwitch(row) {
  const input = row.getByRole("switch");
  assert.equal(await input.isDisabled(), false, "the enable switch is usable while the list is idle");
  const before = await input.isChecked();
  await row.locator(".prk-pill-track").click();
  return before;
}
