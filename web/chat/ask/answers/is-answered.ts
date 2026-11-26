
import type { EffectiveAnswer } from "../ask-types.ts";
export const isAnswered = (answer: EffectiveAnswer) => answer.selected.length > 0 || answer.custom !== null;
