import type { LimitsOptions } from "../../config/limits/limits-options.ts";
import type { ProjectSelection } from "../projects/project-types.ts";
import { object } from "./is-record.ts";
import { keys } from "./fields/has-only-fields.ts";
import { routingIdentifier } from "./fields/is-routing-identifier.ts";
import { label } from "./fields/is-label.ts";

export function validProjectSelection(value: unknown, limits: LimitsOptions, allowNew: boolean): value is ProjectSelection {
  return object(value) && keys(value, ["id", "name"]) && label(value.name, limits)
    && (allowNew && value.id === undefined || routingIdentifier(value.id, limits));
}
