import { useVisible } from "./use-visible.js";
export function FilePanelPart({ Panel, api, params }) {
  const visible = useVisible(api);
  return <Panel id={api.id} path={params.path} visible={visible} />;
}
