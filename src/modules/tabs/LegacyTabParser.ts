import { CodeTab } from "@/modules/tabs/types";
import { resolveLanguage } from "@/modules/tabs/language";

export type ParseErrorKey =
    | "parser.headErr"
    | "parser.noTitle"
    | "parser.noLang"
    | "parser.noCode"
    | "parser.multiActive";

export type ParseError = {
    key: ParseErrorKey;
    index?: number;
    preview?: string;
    title?: string;
};

export type ParseResult = {
    result: boolean;
    code: CodeTab[];
    errors: ParseError[];
};

/**
 * 旧版 tabs 语法解析器（保留新语法兼容）。
 */
export class LegacyTabParser {
    /**
     * 识别语法类型并分派到对应解析器。
     * @param codeText 输入文本
     * @returns 解析结果
     */
    static parseTabSyntax(codeText: string): ParseResult {
        codeText = codeText.trim();
        // 兼容旧语法
        if (codeText.startsWith("tab:::")) {
            return this.parseLegacy(codeText);
        }
        // 新语法
        if (codeText.startsWith(":::")) {
            return this.parseNew(codeText);
        }
        const firstLine = this.getPreviewLine(codeText);
        return this.fail({
            key: "parser.headErr",
            preview: firstLine,
        });
    }

    /**
     * 解析新语法（::: 标记）。
     * @param codeText 输入文本
     * @returns 解析结果
     */
    private static parseNew(codeText: string): ParseResult {
        // 使用正则分割，匹配行首的 ::: (忽略前面的换行)
        const parts = codeText.split(/(?:^|\n):::/g);
        if (parts[0].trim() === "") parts.shift();

        const codeResult: CodeTab[] = [];
        let activeCount = 0;

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
                return this.fail({
                    key: "parser.noTitle",
                    index: i + 1,
                    preview: this.getPreviewLine(headerLine),
                });
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

            // 兼容：无语言时尝试用标题推断
            if (!language) {
                language = resolveLanguage(title);
            } else {
                // 校验语言有效性
                language = resolveLanguage(language);
            }

            if (!codeContent || codeContent.trim().length === 0) {
                return this.fail({
                    key: "parser.noCode",
                    index: i + 1,
                    title,
                });
            }

            if (isActive) {
                activeCount += 1;
                if (activeCount > 1) {
                    return this.fail({
                        key: "parser.multiActive",
                        index: i + 1,
                    });
                }
                codeResult.push({
                    title: title,
                    language: language,
                    code: codeContent,
                    isActive: true,
                });
            } else {
                codeResult.push({
                    title: title,
                    language: language,
                    code: codeContent,
                    isActive: false,
                });
            }
        }
        return { result: true, code: codeResult, errors: [] };
    }

    /**
     * 解析旧语法（tab::: 标记）。
     * @param codeText 输入文本
     * @returns 解析结果
     */
    private static parseLegacy(codeText: string): ParseResult {
        const codeArr = codeText.match(/tab:::([\s\S]*?)(?=\ntab:::|$)/g);
        if (!codeArr) {
            return this.fail({
                key: "parser.headErr",
                preview: this.getPreviewLine(codeText),
            });
        }

        const codeResult: CodeTab[] = [];
        let activeCount = 0;
        for (let i = 0; i < codeArr.length; i++) {
            const codeSplitArr = codeArr[i].trim().split("\n");
            if (
                codeSplitArr.length === 1 ||
                (codeSplitArr.length === 2 && codeSplitArr[1].trim().startsWith("lang:::"))
            ) {
                return this.fail({
                    key: "parser.noCode",
                    index: i + 1,
                    preview: this.getPreviewLine(codeSplitArr[0]),
                });
            }
            if (codeSplitArr[0].length < 7) {
                return this.fail({
                    key: "parser.noTitle",
                    index: i + 1,
                    preview: this.getPreviewLine(codeSplitArr[0]),
                });
            }
            let title = codeSplitArr[0].substring(6).trim();
            let isActive = false;
            if (title.includes(":::active")) {
                activeCount += 1;
                if (activeCount > 1) {
                    return this.fail({
                        key: "parser.multiActive",
                        index: i + 1,
                    });
                }
                isActive = true;
                title = title.replace(":::active", "").trim();
            }
            let language = "";
            if (codeSplitArr[1].trim().startsWith("lang:::")) {
                const languageLine = codeSplitArr[1].trim();
                if (languageLine.length < 8) {
                    return this.fail({
                        key: "parser.noLang",
                        index: i + 1,
                        preview: this.getPreviewLine(languageLine),
                    });
                }
                language = languageLine.substring(7).trim().toLowerCase();

                codeSplitArr.splice(1, 1);
            }
            codeSplitArr.shift();
            const code = codeSplitArr.join("\n").trim();
            if (!code || code.trim().length === 0) {
                return this.fail({
                    key: "parser.noCode",
                    index: i + 1,
                    title,
                });
            }
            if (language === "") {
                language = title.trim();
            }
            language = resolveLanguage(language);
            codeResult.push({
                title: title,
                language: language,
                code: code,
                isActive: isActive,
            });
        }
        return { result: true, code: codeResult, errors: [] };
    }

    /**
     * 生成可读的错误预览行，避免错误信息过长。
     * @param text 原始文本
     * @returns 预览行
     */
    private static getPreviewLine(text: string): string {
        const line = text.split("\n")[0]?.trim() ?? "";
        if (line.length <= 60) return line || "(空)";
        return `${line.slice(0, 57)}...`;
    }

    /**
     * 统一错误输出结构。
     * @param error 错误信息
     * @returns 失败结果
     */
    private static fail(error: ParseError): ParseResult {
        return { result: false, code: [], errors: [error] };
    }
}
