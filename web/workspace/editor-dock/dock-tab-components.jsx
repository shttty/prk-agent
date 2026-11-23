import { FILE_COMPONENT } from "../editor-layout/editor-layout-constants.js";
import { DIFF_COMPONENT } from "../editor-layout/editor-layout-constants.js";
import { TERMINAL_COMPONENT } from "../editor-layout/editor-layout-constants.js";

/** dockview tab components for the workspace's file, diff and shell tabs. */
export const dockTabComponents = ({ FileTab, DiffTab, TerminalTab }) => ({
  [FILE_COMPONENT]: ({ api, params }) => <FileTab id={api.id} path={params.path} />,
  [DIFF_COMPONENT]: ({ api, params }) => <DiffTab id={api.id} path={params.path} />,
  [TERMINAL_COMPONENT]: ({ params }) => <TerminalTab name={params.name} />,
});
