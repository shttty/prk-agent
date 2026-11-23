export function stackFrames(stack: string | undefined, headline: string, maxLines: number): string[] {
  const frames = typeof stack === "string" ? stack.split("\n") : [];
  if (frames[0] === headline) frames.shift();
  return frames.slice(0, maxLines).filter((frame) => frame.trim());
}
