import Color from "colorjs.io";
import { resolvedTokens, type ThemeDocument } from "../../../shared/themes.ts";
import { over } from "./contrast/over.ts";
import { c as readColor } from "./contrast/read-color.ts";
import { mix } from "./contrast/mix.ts";
import { tint as tintColor } from "./contrast/tint.ts";

export function themeWarnings(theme: ThemeDocument) {
  const tokens = resolvedTokens(theme);
  const c = readColor.bind(undefined, tokens);
  const bg = over(c("bg"), new Color(theme.mode === "light" ? "white" : "black"));
  const code = over(c("code-bg"), bg);
  const dim = mix(c("muted"), c("faint"), 0.3);
  const tint = tintColor.bind(undefined, code, c);
  const gutter = tint("code-ink", 0.06);
  const pairs: [string, string, Color, Color][] = [
    ["body", "正文 / 页面", c("ink"), bg],
    ["secondary", "次要文字 / 页面", c("muted"), bg],
    ["line-number", "行号 / 行号栏", dim, gutter],
    ["comment", "注释 / 代码背景", c("syn-comment"), code],
  ];
  for (const key of ["surface", "sidebar", "tree", "surface-2", "overlay-solid"]) {
    pairs.push([`body-${key}`, `正文 / ${key}`, c("ink"), over(c(key), bg)], [`secondary-${key}`, `次要文字 / ${key}`, c("muted"), over(c(key), bg)]);
  }
  for (const [kind, key, syntax, share] of [["add", "ok", "syn-inserted", theme.mode === "light" ? 0.18 : 0.08], ["del", "danger", "syn-deleted", theme.mode === "light" ? 0.12 : 0.08]] as const) {
    const label = kind === "add" ? "diff 增行" : "diff 删行";
    const background = tint(key, share);
    pairs.push([`diff-${kind}`, `${label} / 背景`, c("code-ink"), background], [`diff-${kind}-number`, `${label}行号 / 背景`, c(key), tint(key, share, gutter)], [`diff-${kind}-syntax`, `${label}高亮 / 背景`, c(syntax), background]);
  }
  return pairs.map(([id, label, fg, background]) => ({ id, label, ratio: Color.contrastWCAG21(over(fg, background), background) })).filter(({ ratio }) => ratio < 4.5);
}
