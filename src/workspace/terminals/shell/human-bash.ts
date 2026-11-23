import { createBashCommand } from "./create-bash-command.ts";
import { createBashRc } from "./create-bash-rc.ts";

export const HUMAN_BASH_COMMAND = createBashCommand(createBashRc());
