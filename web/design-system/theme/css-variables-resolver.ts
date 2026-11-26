import type { ConvertCSSVariablesInput } from "@mantine/core";
import { palette } from "../../../shared/palette.ts";
import { schemeVariables } from "./scheme-variables.ts";

export function cssVariablesResolver(): ConvertCSSVariablesInput {
  return {
    variables: {},
    light: schemeVariables(palette.light.tokens),
    dark: schemeVariables(palette.dark.tokens),
  };
}
