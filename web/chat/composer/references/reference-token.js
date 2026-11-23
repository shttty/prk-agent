
export function referenceToken(value) {
  const match = /(?:^|\s)@([^\s@]*)$/.exec(value);
  return match ? match[1] : null;
}
