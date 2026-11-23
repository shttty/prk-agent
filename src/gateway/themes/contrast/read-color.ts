import Color from "colorjs.io";

export const c = (tokens: Record<string, string>, key: string) => new Color(tokens[`--pi-${key}`]!);
