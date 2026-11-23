import type { RuntimeContext } from "../runtime-state.ts";

export function resourceDefaults(ctx: RuntimeContext) {
  return {
    noExtensions: ctx.sessionOptions.noExtensions,
    noSkills: ctx.sessionOptions.noSkills,
    noPromptTemplates: ctx.sessionOptions.noPromptTemplates,
    noThemes: ctx.sessionOptions.noThemes,
    noContextFiles: ctx.sessionOptions.noContextFiles,
    systemPrompt: [
      `You are independent session ${JSON.stringify(ctx.sessionManager.getSessionId())}.`,
      "Python variables persist between requests to this session. Do not assume another session's context or target filesystem.",
      "Store nothing for task progress, one-off scripts/results, or changing current state.",
      ...(ctx.dependencies.roleInstructions ? [`Role instructions:\n${ctx.dependencies.roleInstructions}`] : []),
      "Use session operations deliberately; do not retry a side effect whose execution outcome is unknown.",
      "Report concrete results or explicit failures without pretending that an uncertain target-side action completed.",
    ].join("\n"),
  } as const;
}
