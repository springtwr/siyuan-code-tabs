import { Setting } from "siyuan";

import { TAB_WIDTH_DEFAULT, TAB_WIDTH_MAX, TAB_WIDTH_MIN, TAB_WIDTH_SETTING_KEY } from "@/constants";
import { t } from "@/utils/i18n";
import type { TabWidthSetting } from "@/modules/tabs/types";

type SettingsPanelOptions = {
    i18n: Record<string, string>;
    data: Record<string, unknown>;
    onAllTabsToPlainCode: () => void;
    onSaveConfig: () => Promise<void>;
    buildDebugToggle: () => HTMLInputElement;
};

export class SettingsPanel {
    private readonly i18n: Record<string, string>;
    private readonly data: Record<string, unknown>;
    private readonly onAllTabsToPlainCode: () => void;
    private readonly onSaveConfig: () => Promise<void>;
    private readonly buildDebugToggle: () => HTMLInputElement;
    private readonly activeColorKey = "codeTabsActiveColor";
    private readonly defaultActiveColor = "#7f6df2";
    private readonly tabWidthKey = TAB_WIDTH_SETTING_KEY;
    private activeColorInput?: HTMLInputElement;
    private tabWidthSelect?: HTMLSelectElement;
    private tabWidthInput?: HTMLInputElement;

    constructor(options: SettingsPanelOptions) {
        this.i18n = options.i18n;
        this.data = options.data;
        this.onAllTabsToPlainCode = options.onAllTabsToPlainCode;
        this.onSaveConfig = options.onSaveConfig;
        this.buildDebugToggle = options.buildDebugToggle;
    }

    init(setting: Setting): void {
        setting.addItem({
            title: `${t(this.i18n, "setting.allTabsToPlainCode.title")}`,
            description: `${t(this.i18n, "setting.allTabsToPlainCode.desc")}`,
            actionElement: this.createSettingButton("setting.allTabsToPlainCode.button", () => {
                this.onAllTabsToPlainCode();
            }),
        });
        setting.addItem({
            title: `${t(this.i18n, "setting.activeColor.title")}`,
            description: `${t(this.i18n, "setting.activeColor.desc")}`,
            actionElement: this.buildActiveColorSetting(),
        });
        setting.addItem({
            title: `${t(this.i18n, "setting.tabWidth.title")}`,
            description: `${t(this.i18n, "setting.tabWidth.desc")}`,
            actionElement: this.buildTabWidthSetting(),
        });
        setting.addItem({
            title: `${t(this.i18n, "setting.debug.title")}`,
            description: `${t(this.i18n, "setting.debug.desc")}`,
            actionElement: this.buildDebugToggle(),
        });
    }

    ensureSettings(): void {
        this.ensureActiveColorSettings();
        this.ensureTabWidthSettings();
    }

    applySettings(): void {
        this.applyActiveTabColors();
        this.applyTabWidthSetting();
    }

    syncInputs(): void {
        this.syncActiveColorInputValue();
        this.syncTabWidthSettingInputs();
    }

    private createSettingButton(textKey: string, onClick: () => void): HTMLButtonElement {
        const button = document.createElement("button");
        button.className = "b3-button b3-button--outline fn__flex-center fn__size200";
        button.textContent = `${t(this.i18n, textKey)}`;
        button.addEventListener("click", onClick);
        return button;
    }

    private buildActiveColorSetting(): HTMLDivElement {
        const activeColorWrapper = document.createElement("div");
        activeColorWrapper.className = "fn__flex fn__flex-center code-tabs__setting-color";

        const activeColorInput = document.createElement("input");
        activeColorInput.type = "color";
        activeColorInput.value = this.getActiveColorValue() ?? this.defaultActiveColor;
        activeColorInput.className = "code-tabs__setting-color-input";
        this.activeColorInput = activeColorInput;

        const resetButton = this.createSettingButton("setting.activeColor.reset", () => {
            this.data[this.activeColorKey] = "";
            activeColorInput.value = this.defaultActiveColor;
            this.applyActiveTabColors();
            this.saveConfig();
        });

        const applyColors = () => {
            this.applyActiveTabColors();
            this.saveConfig();
        };

        activeColorInput.addEventListener("input", () => {
            this.data[this.activeColorKey] = activeColorInput.value;
            applyColors();
        });

        activeColorWrapper.appendChild(activeColorInput);
        activeColorWrapper.appendChild(resetButton);
        return activeColorWrapper;
    }

    private buildTabWidthSetting(): HTMLDivElement {
        const wrapper = document.createElement("div");
        wrapper.className = "code-tabs__setting-width";

        const modeSelect = document.createElement("select");
        modeSelect.className = "b3-select code-tabs__setting-width-select";
        const optionAuto = document.createElement("option");
        optionAuto.value = "auto";
        optionAuto.textContent = t(this.i18n, "setting.tabWidth.auto");
        const optionMax = document.createElement("option");
        optionMax.value = "max-chars";
        optionMax.textContent = t(this.i18n, "setting.tabWidth.max");
        modeSelect.appendChild(optionMax);
        modeSelect.appendChild(optionAuto);

        const maxInput = document.createElement("input");
        maxInput.type = "number";
        maxInput.min = String(TAB_WIDTH_MIN);
        maxInput.max = String(TAB_WIDTH_MAX);
        maxInput.step = "1";
        maxInput.className = "b3-text-field code-tabs__setting-width-input";

        const unit = document.createElement("span");
        unit.className = "code-tabs__setting-width-unit";
        unit.textContent = t(this.i18n, "setting.tabWidth.unit");

        this.tabWidthSelect = modeSelect;
        this.tabWidthInput = maxInput;

        const apply = () => {
            const setting = this.normalizeTabWidthSetting({
                mode: modeSelect.value,
                maxChars: maxInput.value,
            });
            this.data[this.tabWidthKey] = setting;
            this.applyTabWidthSetting();
            this.saveConfig();
            this.syncTabWidthSettingInputs();
        };

        modeSelect.addEventListener("change", apply);
        maxInput.addEventListener("change", apply);

        wrapper.appendChild(modeSelect);
        wrapper.appendChild(maxInput);
        wrapper.appendChild(unit);

        this.syncTabWidthSettingInputs();
        return wrapper;
    }

    private ensureActiveColorSettings(): void {
        if (!(this.activeColorKey in this.data)) {
            this.data[this.activeColorKey] = "";
        }
    }

    private syncActiveColorInputValue(): void {
        if (this.activeColorInput) {
            const value = this.getActiveColorValue() ?? this.defaultActiveColor;
            this.activeColorInput.value = value;
        }
    }

    private getActiveColorValue(): string | undefined {
        const value = this.data[this.activeColorKey];
        if (typeof value !== "string") return undefined;
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
    }

    private applyActiveTabColors(): void {
        const root = document.documentElement;
        const activeColor = this.getActiveColorValue();
        if (activeColor) {
            root.style.setProperty("--code-tabs-active-color", activeColor);
        } else {
            root.style.removeProperty("--code-tabs-active-color");
        }
    }

    private clampTabWidth(value: unknown): number {
        const num = typeof value === "number" ? value : Number(value);
        if (!Number.isFinite(num)) return TAB_WIDTH_DEFAULT;
        return Math.min(TAB_WIDTH_MAX, Math.max(TAB_WIDTH_MIN, Math.round(num)));
    }

    private normalizeTabWidthSetting(value: unknown): TabWidthSetting {
        if (!this.isRecord(value)) {
            return { mode: "max-chars", maxChars: TAB_WIDTH_DEFAULT };
        }
        const mode = value.mode === "auto" ? "auto" : "max-chars";
        const maxChars = this.clampTabWidth(value.maxChars);
        return { mode, maxChars };
    }

    private getTabWidthSetting(): TabWidthSetting {
        const normalized = this.normalizeTabWidthSetting(this.data[this.tabWidthKey]);
        this.data[this.tabWidthKey] = normalized;
        return normalized;
    }

    private ensureTabWidthSettings(): void {
        this.getTabWidthSetting();
    }

    private syncTabWidthSettingInputs(): void {
        if (!this.tabWidthSelect || !this.tabWidthInput) return;
        const setting = this.getTabWidthSetting();
        this.tabWidthSelect.value = setting.mode;
        this.tabWidthInput.value = String(setting.maxChars);
        this.tabWidthInput.disabled = setting.mode === "auto";
    }

    private applyTabWidthSetting(): void {
        const setting = this.getTabWidthSetting();
        const root = document.documentElement;
        if (setting.mode === "auto") {
            root.style.setProperty("--code-tabs-max-width", "none");
        } else {
            root.style.setProperty("--code-tabs-max-width", `${setting.maxChars}ch`);
        }
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === "object" && value !== null;
    }

    private saveConfig(): void {
        void this.onSaveConfig();
    }
}
