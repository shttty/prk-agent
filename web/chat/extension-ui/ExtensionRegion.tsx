import { useWorkbench } from "../../workbench/subscription/use-workbench.ts";
import type { ChatActions } from "../thread/chat-actions-types.ts";
import { nativeWidget } from "./widgets/native-widget.ts";
import { ExtensionNode } from "./ExtensionNode.tsx";
/** Header/footer, or the widgets of one placement: each in its own tray card, unless plugin-renderers.js draws it natively. */
export function ExtensionRegion({ actions, placement }: { actions: ChatActions; placement: string }) {
  const render = useWorkbench((state) => state.session.extensionUiRender);
  const act = (args: { nodeId: string; componentOperation: string; value?: unknown }) => { void actions.extensionUiAction("component", args); };
  if (placement === "header" || placement === "footer") return render?.[placement] ? <ExtensionNode node={render[placement]} onAction={act} className={`extension-ui-${placement}`} /> : null;
  return (render?.widgets || []).filter((widget) => widget.placement === placement).map((widget) => {
    const native = nativeWidget(widget.key, widget.node);
    if (native) return <native.Component key={widget.key} data={native.data} />;
    return <div key={widget.key} className="extension-ui-widget" data-placement={placement} data-widget-key={widget.key}><ExtensionNode node={widget.node} onAction={act} /></div>;
  });
}
