/** One configured memory layer. `path` is absolute and may hold `{instance}` and `{project}`. */
export interface LayerSpec {
  readonly name: string;
  readonly path: string;
  readonly description: string;
  readonly capacityCharacters: number;
  /** Over capacity is only a reminder, never a refusal (standing rules). */
  readonly soft: boolean;
  /** Written only on an explicit user instruction to set or change a rule. */
  readonly explicitOnly: boolean;
  /** Background review may write it. */
  readonly review: boolean;
}

export interface ReviewSettings {
  readonly enabled: boolean;
  /** Review after this many user inputs since the last review… */
  readonly userTurns: number;
  /** …or after this many tool calls, whichever comes first; both counters reset after a review. */
  readonly toolCalls: number;
}

/** The merged configuration every host reads from the memories directory. */
export interface LayerSettings {
  /** In authority order: earlier layers win. */
  readonly layers: readonly LayerSpec[];
  /** Project registry root: `<projectsDirectory>/<id>/project.json` and the project's files. */
  readonly projectsDirectory: string;
  readonly review: ReviewSettings;
}

/** Values the `{instance}` / `{project}` path variables resolve against, fixed per session. */
export interface LayerScope {
  readonly instance: string;
  readonly project?: string;
}
