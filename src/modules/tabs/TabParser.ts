import { pushMsg } from "@/api";
import { CodeTab } from "@/modules/tabs/types";
import { IObject } from "siyuan";
import logger from "@/utils/logger";
import { t } from "@/utils/i18n";

export class TabParser {
    static checkCodeText(
        codeText: string,
        i18n: IObject,
        silent: boolean = false
    ): { result: boolean; code: CodeTab[] } {
        codeText = codeText.trim();
        logger.debug("开始解析代码块语法", { length: codeText.length });
        // 兼容旧语法
        if (codeText.startsWith("tab:::")) {
            return this.parseLegacy(codeText, i18n, silent);
        }
        // 新语法
        if (codeText.startsWith(":::")) {
            return this.parseNew(codeText, i18n, silent);
        }
        const firstLine = this.getPreviewLine(codeText);
        if (!silent) {
            pushMsg(`${t(i18n, "parser.headErr")} | 当前内容: ${firstLine}`).then();
        }
        logger.warn("语法检查失败：未匹配到可用语法前缀", { preview: firstLine });
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

    private static parseNew(
        codeText: string,
        i18n: IObject,
        silent: boolean
    ): { result: boolean; code: CodeTab[] } {
        // 使用正则分割，匹配行首的 ::: (忽略前面的换行)
        const parts = codeText.split(/(?:^|\n):::/g);
        if (parts[0].trim() === "") parts.shift();

        const codeResult: CodeTab[] = [];
        logger.debug("解析新语法标签", { count: parts.length });

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
                if (!silent) {
                    pushMsg(
                        `${t(i18n, "parser.noTitle")}（第 ${i + 1} 个标签） | 头部: ${this.getPreviewLine(
                            headerLine
                        )}`
                    ).then();
                }
                logger.warn("新语法解析失败：缺少标题", { index: i + 1 });
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
                if (!silent) {
                    pushMsg(
                        `${t(i18n, "parser.noCode")}（第 ${i + 1} 个标签） | 标题: ${title}`
                    ).then();
                }
                logger.warn("新语法解析失败：缺少代码内容", { index: i + 1, title });
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
        logger.debug("新语法解析完成", { count: codeResult.length });
        return { result: true, code: codeResult };
    }

    private static parseLegacy(
        codeText: string,
        i18n: IObject,
        silent: boolean
    ): { result: boolean; code: CodeTab[] } {
        const codeArr = codeText.match(/tab:::([\s\S]*?)(?=\ntab:::|$)/g);
        if (!codeArr) return { result: false, code: [] };

        const codeResult: CodeTab[] = [];
        logger.debug("解析旧语法标签", { count: codeArr.length });
        for (let i = 0; i < codeArr.length; i++) {
            const codeSplitArr = codeArr[i].trim().split("\n");
            if (
                codeSplitArr.length === 1 ||
                (codeSplitArr.length === 2 && codeSplitArr[1].trim().startsWith("lang:::"))
            ) {
                if (!silent) {
                    pushMsg(
                        `${t(i18n, "parser.noCode")}（第 ${i + 1} 个标签） | 头部: ${this.getPreviewLine(
                            codeSplitArr[0]
                        )}`
                    ).then();
                }
                logger.warn("旧语法解析失败：缺少代码内容", { index: i + 1 });
                return { result: false, code: [] };
            }
            if (codeSplitArr[0].length < 7) {
                if (!silent) {
                    pushMsg(
                        `${t(i18n, "parser.noTitle")}（第 ${i + 1} 个标签） | 头部: ${this.getPreviewLine(
                            codeSplitArr[0]
                        )}`
                    ).then();
                }
                logger.warn("旧语法解析失败：缺少标题", { index: i + 1 });
                return { result: false, code: [] };
            }
            const title = codeSplitArr[0].substring(6).trim();
            let language = "";
            if (codeSplitArr[1].trim().startsWith("lang:::")) {
                const languageLine = codeSplitArr[1].trim();
                if (languageLine.length < 8) {
                    if (!silent) {
                        pushMsg(
                            `${t(i18n, "parser.noLang")}（第 ${i + 1} 个标签） | 行内容: ${this.getPreviewLine(
                                languageLine
                            )}`
                        ).then();
                    }
                    logger.warn("旧语法解析失败：语言标记不完整", { index: i + 1 });
                    return { result: false, code: [] };
                }
                language = languageLine.substring(7).trim().toLowerCase();

                codeSplitArr.splice(1, 1);
            }
            codeSplitArr.shift();
            const code = codeSplitArr.join("\n").trim();
            if (!code) {
                if (!silent) {
                    pushMsg(
                        `${t(i18n, "parser.noCode")}（第 ${i + 1} 个标签） | 标题: ${title}`
                    ).then();
                }
                logger.warn("旧语法解析失败：缺少代码内容", { index: i + 1 });
                return { result: false, code: [] };
            }
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
        logger.debug("旧语法解析完成", { count: codeResult.length });
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
