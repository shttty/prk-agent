import type { ThemeBg, ThemeColor, Theme } from "@earendil-works/pi-coding-agent";
import type { Component } from "@earendil-works/pi-tui";
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { ProbeCase } from "./probe-types.ts";

const foregroundLabels = {
  accent: "accent",
  border: "border",
  borderAccent: "borderAccent",
  borderMuted: "borderMuted",
  success: "success",
  error: "error",
  warning: "warning",
  muted: "muted",
  dim: "dim",
  text: "text",
  thinkingText: "thinkingText",
  scrollbarTrack: "scrollbarTrack",
  scrollbarThumb: "scrollbarThumb",
  searchMatchText: "searchMatchText",
  userMessageText: "userMessageText",
  customMessageText: "customMessageText",
  customMessageLabel: "customMessageLabel",
  toolTitle: "toolTitle",
  toolOutput: "toolOutput",
  mdHeading: "mdHeading",
  mdLink: "mdLink",
  mdLinkUrl: "mdLinkUrl",
  mdCode: "mdCode",
  mdCodeBlock: "mdCodeBlock",
  mdCodeBlockBorder: "mdCodeBlockBorder",
  mdQuote: "mdQuote",
  mdQuoteBorder: "mdQuoteBorder",
  mdHr: "mdHr",
  mdListBullet: "mdListBullet",
  toolDiffAdded: "toolDiffAdded",
  toolDiffRemoved: "toolDiffRemoved",
  toolDiffContext: "toolDiffContext",
  syntaxComment: "syntaxComment",
  syntaxKeyword: "syntaxKeyword",
  syntaxFunction: "syntaxFunction",
  syntaxVariable: "syntaxVariable",
  syntaxString: "syntaxString",
  syntaxNumber: "syntaxNumber",
  syntaxType: "syntaxType",
  syntaxOperator: "syntaxOperator",
  syntaxPunctuation: "syntaxPunctuation",
  thinkingOff: "thinkingOff",
  thinkingMinimal: "thinkingMinimal",
  thinkingLow: "thinkingLow",
  thinkingMedium: "thinkingMedium",
  thinkingHigh: "thinkingHigh",
  thinkingXhigh: "thinkingXhigh",
  thinkingMax: "thinkingMax",
  bashMode: "bashMode",
} satisfies Record<ThemeColor, string>;

const backgroundLabels = {
  selectedBg: "selectedBg",
  searchMatchBg: "searchMatchBg",
  userMessageBg: "userMessageBg",
  customMessageBg: "customMessageBg",
  toolPendingBg: "toolPendingBg",
  toolSuccessBg: "toolSuccessBg",
  toolErrorBg: "toolErrorBg",
} satisfies Record<ThemeBg, string>;

class ThemePage implements Component {
  private readonly lines: string[];
  private readonly done: () => void;

  constructor(lines: string[], done: () => void) {
    this.lines = lines;
    this.done = done;
  }

  render(_width: number): string[] {
    return this.lines;
  }

  handleInput(data: string): void {
    if (data === "\u001b" || data === "\u0003") this.done();
  }

  invalidate(): void {}
}

function openThemePage(ctx: ExtensionCommandContext, label: string, render: (theme: Theme) => string[]): Promise<void> {
  return ctx.ui.custom<void>((_tui, theme, _keybindings, done) => new ThemePage([
    `THEME ${label} · active=${theme.name ?? "unnamed"}`,
    ...render(theme),
    "Esc closes; switch cc-dark, cc-light, or system in the parent probe first.",
  ], () => done(undefined)));
}

function foregroundPage(ctx: ExtensionCommandContext, page: number, tokens: ThemeColor[]): Promise<void> {
  return openThemePage(ctx, `fg page ${page}`, (theme) => tokens.map((token) => `${foregroundLabels[token]}: ${theme.fg(token, foregroundLabels[token])}`));
}


const foregroundTokens = Object.keys(foregroundLabels) as ThemeColor[];
const fgPage1 = foregroundTokens.slice(0, 20);
const fgPage2 = foregroundTokens.slice(20, 40);
const fgPage3 = foregroundTokens.slice(40);

export const themeCases = {
  "theme-fg-1": (ctx: ExtensionCommandContext) => foregroundPage(ctx, 1, fgPage1),
  "theme-fg-2": (ctx: ExtensionCommandContext) => foregroundPage(ctx, 2, fgPage2),
  "theme-fg-3": (ctx: ExtensionCommandContext) => foregroundPage(ctx, 3, fgPage3),
  "theme-bg": (ctx: ExtensionCommandContext) => openThemePage(ctx, "bg", (theme) => (Object.keys(backgroundLabels) as ThemeBg[]).map((token) => `${backgroundLabels[token]}: ${theme.bg(token, backgroundLabels[token])}`)),
  "theme-styles": (ctx: ExtensionCommandContext) => openThemePage(ctx, "styles", (theme) => [
    `bold: ${theme.bold("bold sample")}`,
    `italic: ${theme.italic("italic sample")}`,
    `underline: ${theme.underline("underline sample")}`,
    `inverse: ${theme.inverse("inverse sample")}`,
    `strikethrough: ${theme.strikethrough("strikethrough sample")}`,
  ]),
} satisfies Record<string, ProbeCase>;

export const themeTokenCoverage = {
  fg: foregroundLabels,
  bg: backgroundLabels,
} as const;
