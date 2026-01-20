import { pushMsg } from "@/api";
import { CodeTab } from "@/modules/tabs/types";
import { IObject } from "siyuan";

export class TabParser {
    static checkCodeText(codeText: string, i18n: IObject): { result: boolean; code: CodeTab[] } {
        codeText = codeText.trim();
        // 兼容旧语法
        if (codeText.startsWith("tab:::")) {
            return this.parseLegacy(codeText, i18n);
        }
        // 新语法
        if (codeText.startsWith(":::")) {
            return this.parseNew(codeText, i18n);
        }
        const firstLine = this.getPreviewLine(codeText);
        pushMsg(`${i18n.headErrWhenCheckCode} | 当前内容: ${firstLine}`).then();
        return { result: false, code: [] };
    }

    static generateNewSyntax(tabs: CodeTab[]): string {
        let result = "";
        for (const tab of tabs) {
            let title = tab.title;
            let active = "";

            // 提取标题中的激活标记
            if (title.includes(":::active")) {
                title = title.replace(":::active", "").trim();
                active = " | active";
            }

            let lang = tab.language;
            let header = `::: ${title}`;

            // 智能重建：如果语言与标题推断匹配则省略语言标记
            const inferredLang = this.getLanguage(title);
            if (lang !== inferredLang) {
                header += ` | ${lang}`;
            }

            header += active;
            result += `${header}\n${tab.code}\n\n`;
        }
        return result.trim();
    }

    private static parseNew(codeText: string, i18n: IObject): { result: boolean; code: CodeTab[] } {
        // 使用正则分割，匹配行首的 ::: (忽略前面的换行)
        const parts = codeText.split(/(?:^|\n):::/g);
        if (parts[0].trim() === "") parts.shift();

        const codeResult: CodeTab[] = [];

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const firstLineBreak = part.indexOf("\n");
            let headerLine = "";
            let codeContent = "";

            if (firstLineBreak === -1) {
                // 只有一行的情况
                headerLine = part.trim();
            } else {
                headerLine = part.substring(0, firstLineBreak).trim();
                codeContent = part.substring(firstLineBreak + 1).trim();
            }

            const headerParts = headerLine.split("|").map((item) => item.trim());
            const title = headerParts[0];

            if (!title) {
                pushMsg(
                    `${i18n.noTitleWhenCheckCode}（第 ${i + 1} 个标签） | 头部: ${this.getPreviewLine(
                        headerLine
                    )}`
                ).then();
                return { result: false, code: [] };
            }

            let language = "";
            let isActive = false;

            // 检查后续参数
            for (let j = 1; j < headerParts.length; j++) {
                const p = headerParts[j].toLowerCase();
                if (p === "active") {
                    isActive = true;
                } else if (!language) {
                    language = p;
                }
            }

            // 智能推断语言
            if (!language) {
                language = this.getLanguage(title);
            } else {
                // 校验语言有效性
                language = this.getLanguage(language);
            }

            if (!codeContent || codeContent.trim().length === 0) {
                pushMsg(
                    `${i18n.noCodeWhenCheckCode}（第 ${i + 1} 个标签） | 标题: ${title}`
                ).then();
                return { result: false, code: [] };
            }

            if (isActive) {
                codeResult.push({
                    title: `${title} :::active`,
                    language: language,
                    code: codeContent,
                });
            } else {
                codeResult.push({
                    title: title,
                    language: language,
                    code: codeContent,
                });
            }
        }
        return { result: true, code: codeResult };
    }

    private static parseLegacy(
        codeText: string,
        i18n: IObject
    ): { result: boolean; code: CodeTab[] } {
        const codeArr = codeText.match(/tab:::([\s\S]*?)(?=\ntab:::|$)/g);
        if (!codeArr) return { result: false, code: [] };

        const codeResult: CodeTab[] = [];
        for (let i = 0; i < codeArr.length; i++) {
            const codeSplitArr = codeArr[i].trim().split("\n");
            if (
                codeSplitArr.length === 1 ||
                (codeSplitArr.length === 2 && codeSplitArr[1].trim().startsWith("lang:::"))
            ) {
                pushMsg(
                    `${i18n.noCodeWhenCheckCode}（第 ${i + 1} 个标签） | 头部: ${this.getPreviewLine(
                        codeSplitArr[0]
                    )}`
                ).then();
                return { result: false, code: [] };
            }
            if (codeSplitArr[0].length < 7) {
                pushMsg(
                    `${i18n.noTitleWhenCheckCode}（第 ${i + 1} 个标签） | 头部: ${this.getPreviewLine(
                        codeSplitArr[0]
                    )}`
                ).then();
                return { result: false, code: [] };
            }
            const title = codeSplitArr[0].substring(6).trim();
            let language = "";
            if (codeSplitArr[1].trim().startsWith("lang:::")) {
                const languageLine = codeSplitArr[1].trim();
                if (languageLine.length < 8) {
                    pushMsg(
                        `${i18n.noLangWhenCheckCode}（第 ${i + 1} 个标签） | 行内容: ${this.getPreviewLine(
                            languageLine
                        )}`
                    ).then();
                    return { result: false, code: [] };
                }
                language = languageLine.substring(7).trim().toLowerCase();

                codeSplitArr.splice(1, 1);
            }
            codeSplitArr.shift();
            const code = codeSplitArr.join("\n").trim();
            if (language === "") {
                language = title.split(":::active")[0].trim();
            }
            language = this.getLanguage(language);
            codeResult.push({
                title: title,
                language: language,
                code: code,
            });
        }
        return { result: true, code: codeResult };
    }

    private static getLanguage(lang: string) {
        if (lang === "markdown-render") {
            return "markdown-render";
        } else {
            return window.hljs.getLanguage(lang) ? lang.toLowerCase() : "plaintext";
        }
    }

    private static getPreviewLine(text: string): string {
        const line = text.split("\n")[0]?.trim() ?? "";
        if (line.length <= 60) return line || "(空)";
        return `${line.slice(0, 57)}...`;
    }
}
