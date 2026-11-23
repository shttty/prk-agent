import type { UiContext, RuntimeSettingsList, RuntimeInput, RuntimeSelectList } from "../ui-types.ts";
import { componentName } from "./identify-component.ts";
import { isEditor } from "./is-editor.ts";
import { publish } from "../publication/publish-revision.ts";
import { openSettingsSubmenu } from "./open-settings-submenu.ts";
import { select } from "../dialogs/select.ts";
import { input } from "../dialogs/input.ts";

export async function actComponent(ctx: UiContext, args: Record<string, unknown>, nodeId: string): Promise<unknown> {
      const component = typeof args.clientId === "string" ? ctx.clients.get(args.clientId)?.nodes.get(nodeId) : undefined;
      if (!component || ctx.disposedComponents.has(component)) return { status: "unavailable", message: "Component is no longer rendered for this client." };
      const operationName = args.componentOperation;
      if (componentName(component) === "SettingsList") {
        const settings = component as RuntimeSettingsList;
        if (operationName === "cancel" && ctx.settingsSubmenus.has(settings)) { ctx.settingsSubmenus.get(settings)!.close(); return { status: "cancelled" }; }
        if (operationName === "submit" && typeof args.value === "string") {
          const item = settings.items.find((item) => item.id === args.value);
          if (!item?.submenu) return { status: "unavailable", message: "Setting does not expose this submenu." };
          openSettingsSubmenu(ctx, settings, item); return { status: "completed" };
        }
      }
      if (operationName === "change" && typeof args.value === "string" && componentName(component) === "Input") { (component as RuntimeInput).setValue(args.value); publish(ctx); return { status: "completed" }; }
      if (operationName === "change" && typeof args.value === "string" && isEditor(component)) { component.setText(args.value); publish(ctx); return { status: "completed" }; }
      if (operationName === "change" && componentName(component) === "SelectList") {
        const select = component as RuntimeSelectList;
        const index = typeof args.value === "number" ? args.value : select.filteredItems.findIndex((item) => item.value === args.value);
        if (!Number.isInteger(index) || index < 0 || index >= select.filteredItems.length) return { status: "unavailable", message: "Selection is invalid." };
        const previousIndex = select.selectedIndex;
        select.setSelectedIndex(index);
        const selected = select.getSelectedItem();
        if (!selected) return { status: "unavailable", message: "No selection is active." };
        if (previousIndex !== select.selectedIndex) select.onSelectionChange?.(selected);
        publish(ctx); return { status: "completed" };
      }
      if (operationName === "change" && typeof args.value === "object" && args.value !== null && componentName(component) === "SettingsList") {
        const value = args.value as { id?: unknown; value?: unknown };
        if (typeof value.id !== "string" || typeof value.value !== "string") return { status: "unavailable", message: "Settings change is invalid." };
        const settings = component as RuntimeSettingsList;
        const item = settings.items.find((item) => item.id === value.id);
        if (!item || !item.values?.includes(value.value) || !settings.onChange) return { status: "unavailable", message: "Setting does not expose this value change." };
        settings.selectItem(value.id); settings.updateValue(value.id, value.value); settings.onChange(value.id, value.value); publish(ctx); return { status: "completed" };
      }
      if (operationName === "submit" && componentName(component) === "SelectList") { const select = component as RuntimeSelectList; const item = select.getSelectedItem(); if (!item || !select.onSelect) return { status: "unavailable", message: "No public selection callback is active." }; select.onSelect(item); publish(ctx); return { status: "completed", data: item.value }; }
      if (operationName === "cancel" && componentName(component) === "SelectList" && (component as RuntimeSelectList).onCancel) { (component as RuntimeSelectList).onCancel!(); publish(ctx); return { status: "cancelled" }; }
      if (operationName === "cancel" && componentName(component) === "SettingsList" && (component as RuntimeSettingsList).onCancel) { (component as RuntimeSettingsList).onCancel!(); publish(ctx); return { status: "cancelled" }; }
      if (operationName === "submit" && componentName(component) === "Input" && (component as RuntimeInput).onSubmit) {
        const input = component as RuntimeInput;
        if (typeof args.value === "string") input.setValue(args.value);
        await input.onSubmit!(input.getValue()); publish(ctx); return { status: "completed" };
      }
      if (operationName === "submit" && isEditor(component) && component.onSubmit) {
        if (typeof args.value === "string") component.setText(args.value);
        await component.onSubmit(component.getText()); publish(ctx); return { status: "completed" };
      }
      if (operationName === "cancel" && "onEscape" in component && typeof component.onEscape === "function") { component.onEscape(); publish(ctx); return { status: "cancelled" }; }
      return { status: "unavailable", message: "Component operation is not exposed by the component API." };
    
}
