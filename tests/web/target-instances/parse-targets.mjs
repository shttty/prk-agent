import { parsePrkConfig } from "../../../src/config/document/parse-prk-config.ts";

/**
 * A Gateway's explicit `targets`, parsed exactly as instances.toml is: each entry is `{id,label,...}` with the
 * `withTargetFixture` instance fragment (`{local,python,cwd}`) spread in.
 */
export function parseTargets(instances) {
  return parsePrkConfig({}, { instances }).instances;
}
