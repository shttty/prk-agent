import type { UiContext, RuntimeSettingsList, SettingsSubmenu } from "../ui-types.ts";
import type { SettingItem } from "@earendil-works/pi-tui";
import { publish } from "../publication/publish-revision.ts";
import { disposeComponent } from "./dispose-component.ts";
import { closeSettingsSubmenu } from "./close.ts";

export function openSettingsSubmenu(ctx: UiContext, settings: RuntimeSettingsList, item: SettingItem): void {
    const factory = item.submenu;
    if (!factory) throw new Error("Setting does not expose a submenu callback.");
    ctx.settingsSubmenus.get(settings)?.close();
    const owner: SettingsSubmenu = {
      closed: false,
      close: (selectedValue, options) => closeSettingsSubmenu(ctx, settings, item, owner, selectedValue, options),
    };
    ctx.settingsSubmenus.set(settings, owner);
    settings.selectItem(item.id);
    try {
      const component = factory(item.currentValue, owner.close);
      if (owner.closed) disposeComponent(ctx, component); else owner.component = component;
    } catch (error) { owner.close(); throw error; }
    publish(ctx);
  }
