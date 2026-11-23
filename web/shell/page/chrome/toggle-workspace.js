import { setWorkspaceOpen } from "./set-workspace-open.js";
import { layout } from "../../layout/layout-store.js";
export const toggleWorkspace = () => setWorkspaceOpen(!layout.get().workspaceOpen);

