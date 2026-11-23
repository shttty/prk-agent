export const reservedKey = (label: string): string => label.trim().replace(/[….]+$/u, "").trim().toLowerCase();
