
export const hasText = (part) => part?.type === "text" && typeof part.text === "string" && part.text.trim().length > 0;
