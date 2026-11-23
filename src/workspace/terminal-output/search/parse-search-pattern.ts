import { shellWords } from "./parse-shell-words.ts";
import { GREP_VALUES } from "./terminal-output-constants.ts";
import { RG_VALUES } from "./terminal-output-constants.ts";
import { COMMON_FLAGS } from "./terminal-output-constants.ts";
import { RG_FLAGS } from "./terminal-output-constants.ts";

export function searchPattern(command: string): RegExp | undefined {
  const words = shellWords(command);
  const engine = words?.[0]?.split("/").at(-1);
  if (!words || !engine || !["rg", "grep", "egrep", "fgrep"].includes(engine)) return;
  const rg = engine === "rg";
  const values = rg ? RG_VALUES : GREP_VALUES;
  const shortValues = rg ? "ABCEMTdefgjmrt" : "ABCDXdefm";
  const shortFlags = rg ? "abcFHIiLlNnOoPpqSsUuvVwxyz0" : "abcEFGHIihLlnoPqRrsTUVvwxYyZz";
  const patterns: string[] = [];
  let positional: string | undefined, fixed = engine === "fgrep", basic = engine === "grep", insensitive = false, ended = false;
  const flag = (name: string): boolean => {
    if (["v", "invert-match", "file", "f"].includes(name)) return false;
    if (["F", "fixed-strings"].includes(name)) fixed = true;
    if (["E", "P", "extended-regexp", "perl-regexp", "pcre2"].includes(name)) { fixed = false; basic = false; }
    if (["G", "basic-regexp"].includes(name)) { fixed = false; basic = true; }
    if (["i", "ignore-case"].includes(name)) insensitive = true;
    if (["s", "no-ignore-case"].includes(name) && rg) insensitive = false;
    return true;
  };
  for (let index = 1; index < words.length; index++) {
    const word = words[index]!;
    if (!ended && word === "--") { ended = true; continue; }
    if (!ended && word.startsWith("--")) {
      const equal = word.indexOf("=");
      const name = word.slice(2, equal < 0 ? undefined : equal);
      if (Object.hasOwn(values, name)) {
        const value = equal < 0 ? words[++index] : word.slice(equal + 1);
        if (value === undefined || !flag(name)) return;
        if (name === "regexp") patterns.push(value);
      } else {
        if (equal >= 0 && (rg || (name !== "color" && name !== "colour"))) return;
        if (!Object.hasOwn(COMMON_FLAGS, name) && !(rg ? Object.hasOwn(RG_FLAGS, name) : ["color", "colour", "line-buffered", "no-messages"].includes(name))) return;
        if (!flag(name)) return;
      }
    } else if (!ended && word.startsWith("-") && word !== "-") {
      if (!rg && /^-\d+$/u.test(word)) continue;
      for (let part = 1; part < word.length; part++) {
        const name = word[part]!;
        if (shortValues.includes(name)) {
          const attached = word.slice(part + 1);
          const value = attached ? (rg ? attached.replace(/^=/u, "") : attached) : words[++index];
          if (value === undefined || !flag(name)) return;
          if (name === "e") patterns.push(value);
          break;
        }
        if (!shortFlags.includes(name) || !flag(name)) return;
      }
    } else if (positional === undefined) positional = word;
  }
  // With -e, positionals are filenames, not additional patterns.
  if (!patterns.length && positional !== undefined) patterns.push(positional);
  if (!patterns.length || patterns.some((pattern) => !pattern)) return;
  const sources = patterns.flatMap((pattern) => pattern.split("\n")).map((pattern) => {
    if (fixed) return pattern.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    // GNU grep BRE quotes operators that ERE/JS spell without a backslash.
    return basic ? pattern.replace(/\\([+?|(){}])|([+?|(){}])/gu, (_match, escaped: string | undefined, plain: string) => escaped ?? `\\${plain}`) : pattern;
  });
  // POSIX classes and engine-specific escapes have no equivalent JS meaning.
  if (!fixed && sources.some((source) => /\[[:.=]|\\[AZzKQEpP]|\(\?/u.test(source))) return;
  try { return new RegExp(sources.map((source) => `(?:${source})`).join("|"), insensitive ? "giu" : "gu"); }
  catch { return; }
}
