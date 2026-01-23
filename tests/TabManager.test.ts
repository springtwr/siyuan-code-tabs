import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IObject } from "siyuan";
import { TabManager, getCodeFromAttribute } from "@/modules/tabs/TabManager";
import { encodeSource } from "@/utils/encoding";
import { pushErrMsg } from "@/api";

vi.mock("@/api", () => ({
    getBlockAttrs: vi.fn().mockResolvedValue(undefined),
    pushErrMsg: vi.fn().mockResolvedValue(undefined),
    pushMsg: vi.fn().mockResolvedValue(undefined),
    updateBlock: vi.fn().mockResolvedValue(undefined),
}));

const i18n = { "msg.allTabsToCodeFailed": "failed" } as IObject;

describe("TabManager", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        delete (window as Window & { pluginCodeTabs?: unknown }).pluginCodeTabs;
        document.body.innerHTML = "";
    });

    it("getCodeFromAttribute: 应将旧语法转换为新语法并补齐换行", () => {
        const legacy = "tab::: JS\nlang::: js\nconsole.log('ok')";
        const encoded = encodeSource(legacy);
        const result = getCodeFromAttribute("id-1", encoded, i18n);

        expect(result).toBeTruthy();
        expect(result).toContain(":::");
        expect(result).not.toContain("tab:::");
        expect(result?.endsWith("\n")).toBe(true);
    });

    it("copyCode: 使用 clipboard.writeText 复制代码", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, "clipboard", {
            value: { writeText },
            configurable: true,
        });

        TabManager.initGlobalFunctions(i18n);

        const container = document.createElement("div");
        container.className = "tabs-container";

        const tabContents = document.createElement("div");
        tabContents.className = "tab-contents";

        const tabContent = document.createElement("div");
        tabContent.className = "tab-content tab-content--active";
        const code = document.createElement("div");
        code.className = "code";
        code.textContent = "console.log('ok')";
        tabContent.appendChild(code);

        const copyBtn = document.createElement("span");
        copyBtn.className = "code-tabs--icon_copy";
        copyBtn.appendChild(document.createElement("img"));

        tabContents.appendChild(copyBtn);
        tabContents.appendChild(tabContent);
        container.appendChild(tabContents);
        document.body.appendChild(container);

        const evt = new MouseEvent("click", { bubbles: true });
        Object.defineProperty(evt, "currentTarget", { value: copyBtn });
        Object.defineProperty(evt, "target", { value: copyBtn });

        await (
            window as Window & { pluginCodeTabs: { copyCode: (e: MouseEvent) => Promise<void> } }
        ).pluginCodeTabs.copyCode(evt);

        expect(writeText).toHaveBeenCalledWith("console.log('ok')");
    });

    it("copyCode: clipboard.writeText 失败时提示错误", async () => {
        const writeText = vi.fn().mockRejectedValue(new Error("fail"));
        Object.defineProperty(navigator, "clipboard", {
            value: { writeText },
            configurable: true,
        });

        TabManager.initGlobalFunctions(i18n);

        const container = document.createElement("div");
        container.className = "tabs-container";

        const tabContents = document.createElement("div");
        tabContents.className = "tab-contents";

        const tabContent = document.createElement("div");
        tabContent.className = "tab-content tab-content--active";
        const code = document.createElement("div");
        code.className = "code";
        code.textContent = "console.log('fallback')";
        tabContent.appendChild(code);

        const copyBtn = document.createElement("span");
        copyBtn.className = "code-tabs--icon_copy";

        tabContents.appendChild(copyBtn);
        tabContents.appendChild(tabContent);
        container.appendChild(tabContents);
        document.body.appendChild(container);

        const evt = new MouseEvent("click", { bubbles: true });
        Object.defineProperty(evt, "currentTarget", { value: copyBtn });
        Object.defineProperty(evt, "target", { value: copyBtn });

        await (
            window as Window & { pluginCodeTabs: { copyCode: (e: MouseEvent) => Promise<void> } }
        ).pluginCodeTabs.copyCode(evt);

        expect(pushErrMsg).toHaveBeenCalled();
    });
});
