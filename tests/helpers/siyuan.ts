export type IObject = Record<string, unknown>;

export type IMenu = {
    type?: "separator" | "submenu" | "readonly";
    iconHTML?: string;
    label?: string;
    submenu?: IMenu[];
    click?: () => void;
};

export function getActiveEditor(): null {
    return null;
}

export class Plugin {
    data: Record<string, unknown> = {};
    i18n: Record<string, string> = {};
    setting: Setting | undefined;
    eventBus = {
        on: () => {},
        off: () => {},
    };

    addCommand() {}
    addTopBar() {}
    openSetting() {}
}

export class Setting {
    constructor(_options?: { confirmCallback?: () => void }) {}
    addItem() {}
}
