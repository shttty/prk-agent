const COLORS = { pending: "var(--mantine-color-blue-7)", success: "var(--pi-ok)", error: "var(--pi-danger)" };

/** Text colour of a connection test or interpreter check line by its state. */
export const feedbackColor = (state: keyof typeof COLORS): string => COLORS[state];
