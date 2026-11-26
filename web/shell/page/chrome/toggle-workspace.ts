import { setWorkspaceOpen } from "./set-workspace-open.ts";
import { layout } from "../../layout/layout-store.ts";
export const toggleWorkspace = () => setWorkspaceOpen(!layout.get().workspaceOpen);

