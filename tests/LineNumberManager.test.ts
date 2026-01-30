import { beforeEach, describe, expect, it } from "vitest";
import { LineNumberManager } from "@/modules/line-number/LineNumberManager";

describe("LineNumberManager", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        window.siyuan.config.editor.codeSyntaxHighlightLineNum = true;
        window.siyuan.config.editor.codeLineWrap = false;
    });

    it("refreshActive adds line numbers for active tab", () => {
        const container = document.createElement("div");
        container.className = "tabs-container";

        const content = document.createElement("div");
        content.className = "tab-content tab-content--active";
        content.dataset.lang = "js";

        const code = document.createElement("div");
        code.className = "code";
        code.textContent = "line1\nline2";

        content.appendChild(code);
        container.appendChild(content);
        document.body.appendChild(container);

        LineNumberManager.refreshActive(container);

        expect(content.querySelector(".tab-line-num")).not.toBeNull();

        LineNumberManager.cleanup();
    });
});
