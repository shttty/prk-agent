import Color from "colorjs.io";
import { builtinThemes, type ThemeDocument } from "../../../shared/themes.js";
import { object } from "../wire/is-record.ts";
import { WireError } from "../wire/create-error.ts";

export function parseTheme(value: unknown): ThemeDocument {
  if (!object(value)) throw new WireError("INVALID_REQUEST", "主题必须是 JSON 对象。");
  for (const key of Object.keys(value)) if (!["name", "mode", "tokens"].includes(key)) throw new WireError("INVALID_REQUEST", `未知字段：${key}`);
  if (typeof value.name !== "string" || !value.name.trim()) throw new WireError("INVALID_REQUEST", "name：请输入主题名称。");
  if (value.mode !== "light" && value.mode !== "dark") throw new WireError("INVALID_REQUEST", "mode：只接受 light 或 dark。");
  if (!object(value.tokens)) throw new WireError("INVALID_REQUEST", "tokens：必须是颜色对象。");
  const tokens: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value.tokens)) {
    if (!Object.hasOwn(builtinThemes[0]!.tokens, key)) throw new WireError("INVALID_REQUEST", `未知颜色键：${key}`, { key });
    try {
      if (typeof raw !== "string") throw new Error();
      const color = new Color(raw);
      if (![...color.to("srgb").coords, color.alpha].every((part) => typeof part === "number" && Number.isFinite(part))) throw new Error();
      tokens[key] = raw;
    } catch { throw new WireError("INVALID_REQUEST", `非法颜色：${key}。请使用独立 CSS 颜色值。`, { key }); }
  }
  return { name: value.name.trim(), mode: value.mode, tokens };
}
