/** `shell`, then `shell-2`, `shell-3`…: the first name not taken by an open tab or a shell the server knows. */
export function nextShellName(taken: readonly string[]) {
  if (!taken.includes("shell")) return "shell";
  let index = 2;
  while (taken.includes(`shell-${index}`)) index += 1;
  return `shell-${index}`;
}
