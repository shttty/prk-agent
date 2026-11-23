import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import { nativeWidget } from "./widgets/native-widget.js";
import { ExtensionNode } from "./ExtensionNode.jsx";
/** Header/footer, or the widgets of one placement: each in its own tray card, unless plugin-renderers.js draws it natively. */
export function ExtensionRegion({ actions, placement }) {
  const render = useWorkbench((state) => state.session.extensionUiRender);
  const act = (args) => { void actions.extensionUiAction("component", args); };
  if (placement === "header" || placement === "footer") return render?.[placement] ? <ExtensionNode node={render[placement]} onAction={act} className={`extension-ui-${placement}`} /> : null;
  return (render?.widgets || []).filter((widget) => widget.placement === placement).map((widget) => {
    const native = nativeWidget(widget.key, widget.node);
    if (native) return <native.Component key={widget.key} data={native.data} />;
    return <div key={widget.key} className="extension-ui-widget" data-placement={placement} data-widget-key={widget.key}><ExtensionNode node={widget.node} onAction={act} /></div>;
  });
}
