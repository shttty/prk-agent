import type { KeybindingHints } from "@earendil-works/pi-coding-agent";
import type { UiContext } from "../../ui-types.ts";
import { requireTheme } from "../../theme/require-theme.ts";

export function getKeybindingHints(ctx: UiContext): KeybindingHints {
  // Pi's exported helpers read global bindings/theme; hosted renderers use this session's objects.
  const keyText: KeybindingHints["keyText"] = (keybinding) => {
    const keys = ctx.keybindings.getKeys(keybinding).join("/");
    return process.platform === "darwin" ? keys.replace(/(^|[+/])alt(?=[+/]|$)/gi, "$1option") : keys;
  };
  return {
    keyText,
    keyHint: (keybinding, description) => {
      const theme = requireTheme(ctx);
      return theme.fg("dim", keyText(keybinding)) + theme.fg("muted", ` ${description}`);
    },
  };
}
