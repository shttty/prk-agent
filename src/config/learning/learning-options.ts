export interface LearningOptions {
  readonly autoTools: boolean;
  readonly autoSkills: boolean;
}

export const DEFAULT_LEARNING_OPTIONS: LearningOptions = Object.freeze({
  autoTools: true,
  autoSkills: true,
});
