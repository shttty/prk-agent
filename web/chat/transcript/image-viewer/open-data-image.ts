/** Opens a `data:` image in a new tab; browsers will not navigate to a data URL directly. */
export function openDataImage(src: string) {
  const comma = src.indexOf(",");
  const image = new Blob([Uint8Array.from(atob(src.slice(comma + 1)), (char) => char.charCodeAt(0))], { type: src.slice(5, comma - ";base64".length) });
  const url = URL.createObjectURL(image);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
