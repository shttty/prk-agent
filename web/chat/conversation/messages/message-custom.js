
export function messageCustom(message) {
  const images = Array.isArray(message.content) ? message.content.filter((part) => part.type === "image").slice(0, 4) : [];
  return images.length ? {
    attachments: images.map((part, index) => ({ name: `图片 ${index + 1}`, type: part.mimeType || "image/png", data: part.data, source: "sdk" })),
  } : {};
}
