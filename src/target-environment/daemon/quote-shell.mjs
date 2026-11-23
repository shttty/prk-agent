export const quoteShell = (value) => `'${String(value).replaceAll("'", "'\\''")}'`;
