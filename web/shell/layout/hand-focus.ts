
export function handFocus(event: { detail: number }, id: string) {
  if (event.detail === 0) setTimeout(() => document.getElementById(id)?.focus(), 0);
}

