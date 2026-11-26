/** First sentence of a description, for the one grey line under the name. */
export function firstSentence(text: unknown) {
  const value = typeof text === "string" ? text.trim() : "";
  const match = /^.*?[.。!?！？](?=\s|$)/su.exec(value);
  return (match ? match[0] : value.split("\n")[0] ?? "").trim();
}
