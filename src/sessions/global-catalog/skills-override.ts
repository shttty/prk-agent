import type { LoadSkillsResult } from "@earendil-works/pi-coding-agent";
import { preserveGatewaySkillCandidates } from "../resource-catalog/preserve-gateway-skill-candidates.ts";

export const skillsOverride = (base: LoadSkillsResult, cwd: string, agentDir: string) => preserveGatewaySkillCandidates(base, cwd, agentDir);
