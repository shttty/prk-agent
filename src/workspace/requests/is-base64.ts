
export function base64(value: string): boolean {
  const encoded = value.replace(/[\t\n\r ]/gu, "");
  return encoded.length % 4 === 0 && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(encoded);
}
