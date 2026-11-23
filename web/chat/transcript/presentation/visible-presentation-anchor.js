
export function visiblePresentationAnchor(viewport) {
  const viewportTop = viewport.getBoundingClientRect().top;
  const messages = [...viewport.querySelectorAll(".pi-message")];
  const index = messages.findIndex((node) => {
    const rect = node.getBoundingClientRect();
    return rect.bottom > viewportTop + 2 && rect.top < viewportTop + viewport.clientHeight;
  });
  if (index < 0) return null;
  const node = messages[index];
  const key = node.getAttribute("data-message-id") || "";
  return {
    index,
    key,
    role: node.classList.contains("user") ? "user" : node.classList.contains("assistant") ? "assistant" : "system",
    text: (node.textContent || "").slice(0, 160),
    offset: node.getBoundingClientRect().top - viewportTop,
  };
}
