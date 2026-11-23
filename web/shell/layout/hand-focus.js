
export function handFocus(event, id) {
  if (event.detail === 0) setTimeout(() => document.getElementById(id)?.focus(), 0);
}

