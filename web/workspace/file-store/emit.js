
export const emit = (ctx) => { for (const listener of [...ctx.listeners]) listener(); };
