
/** Static single commands only: never evaluate shell expansion or guess pipeline ownership. */
export function shellWords(command: string): string[] | undefined {
  const words: string[] = [];
  let word = "", quote = "", started = false;
  for (let index = 0; index < command.length; index++) {
    const char = command[index]!;
    if (char === "\\" && quote !== "'") {
      const next = command[++index];
      if (next === undefined) return;
      if (next !== "\n") word += quote === '"' && !'$`"\\'.includes(next) ? `\\${next}` : next;
      started = true;
    } else if (quote) {
      if (char === quote) quote = "";
      else {
        if (quote === '"' && "$`".includes(char)) return;
        word += char;
      }
    } else if (char === "'" || char === '"') {
      quote = char;
      started = true;
    } else if (/\s/u.test(char)) {
      if (char === "\n" || char === "\r") return;
      if (started) { words.push(word); word = ""; started = false; }
    } else {
      if ("$`|&;<>()*?[]{}~".includes(char) || (char === "#" && !started)) return;
      word += char;
      started = true;
    }
  }
  if (quote) return;
  if (started) words.push(word);
  return words;
}
