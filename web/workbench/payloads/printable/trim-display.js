
export function trimDisplay(value) {
  const text = String(value ?? "");
  return text.length > 18_000 ? `${text.slice(0, 18_000)}\n…（内容过长，已省略）` : text;
}

