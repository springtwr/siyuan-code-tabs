import { pushMsg } from "@/api";
import { codeTab } from "@/types";

export class TabParser {
    static checkCodeText(codeText: string, i18n: any): { result: boolean, code: codeTab[] } {
        codeText = codeText.trim();
        // 兼容旧语法
        if (codeText.startsWith('tab:::')) {
            return this.parseLegacy(codeText, i18n);
        }
        // 新语法
        if (codeText.startsWith(':::')) {
            return this.parseNew(codeText, i18n);
        }
        pushMsg(i18n.headErrWhenCheckCode).then();
        return { result: false, code: [] };
    }

    private static parseNew(codeText: string, i18n: any): { result: boolean, code: codeTab[] } {
        // 使用正则分割，匹配行首的 ::: (忽略前面的换行)
        const parts = codeText.split(/(?:^|\n):::/g);
        // 第一部分通常是空的（如果字符串以 ::: 开头），去掉
        if (parts[0].trim() === '') parts.shift();

        const codeResult: codeTab[] = [];

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const firstLineBreak = part.indexOf('\n');
            let headerLine = '';
            let codeContent = '';

            if (firstLineBreak === -1) {
                // 只有一行的情况
                headerLine = part.trim();
            } else {
                headerLine = part.substring(0, firstLineBreak).trim();
                codeContent = part.substring(firstLineBreak + 1).trim();
            }

            // 解析头部 ::: Title | Lang | active
            const headerParts = headerLine.split('|').map(item => item.trim());
            const title = headerParts[0];

            if (!title) {
                pushMsg(`${i18n.noTitleWhenCheckCode} (${i + 1})`).then();
                return { result: false, code: [] };
            }

            let language = '';
            let isActive = false;

            // 检查后续参数
            for (let j = 1; j < headerParts.length; j++) {
                const p = headerParts[j].toLowerCase();
                if (p === 'active') {
                    isActive = true;
                } else if (!language) {
                    language = p; // 第一个非 active 的参数视为语言
                }
            }

            // 智能推断：如果没有指定语言，且标题是有效语言名，则使用标题作为语言
            if (!language) {
                if (window.hljs.getLanguage(title)) {
                    language = title.toLowerCase();
                } else {
                    language = 'plaintext';
                }
            } else {
                // 校验指定语言是否有效，无效则回退 plaintext
                language = window.hljs.getLanguage(language) ? language : 'plaintext';
            }

            if (isActive) {
                // 为了兼容旧的渲染逻辑，将 active 标记拼接到标题后（Renderer 会解析这个 magic string）
                // 也可以修改 Renderer，但为了最小改动，这里保持一致
                // createProtyleHtml 中：if (title.split(':::active').length > 1) 
                // 所以我们这里构造格式
                codeResult.push({
                    title: `${title} :::active`,
                    language: language,
                    code: codeContent
                });
            } else {
                codeResult.push({
                    title: title,
                    language: language,
                    code: codeContent
                });
            }
        }
        return { result: true, code: codeResult };
    }

    private static parseLegacy(codeText: string, i18n: any): { result: boolean, code: codeTab[] } {
        // ... Original Logic ...
        const codeArr = codeText.match(/tab:::([\s\S]*?)(?=\ntab:::|$)/g);
        if (!codeArr) return { result: false, code: [] };

        const codeResult: codeTab[] = [];
        for (let i = 0; i < codeArr.length; i++) {
            const codeSplitArr = codeArr[i].trim().split('\n');
            if (codeSplitArr.length === 1 || (codeSplitArr.length === 2 && codeSplitArr[1].trim().startsWith('lang:::'))) {
                pushMsg(`${i18n.noCodeWhenCheckCode} (${i + 1})`).then();
                return { result: false, code: [] };
            }
            if (codeSplitArr[0].length < 7) {
                pushMsg(`${i18n.noTitleWhenCheckCode} (${i + 1})`).then();
                return { result: false, code: [] };
            }
            const title = codeSplitArr[0].substring(6).trim();
            let language = '';
            if (codeSplitArr[1].trim().startsWith('lang:::')) {
                const languageLine = codeSplitArr[1].trim();
                if (languageLine.length < 8) {
                    pushMsg(`${i18n.noLangWhenCheckCode} (${i + 1})`).then();
                    return { result: false, code: [] };
                }
                language = languageLine.substring(7).trim().toLowerCase();
                // 获取语言类型后删除该行
                codeSplitArr.splice(1, 1);
            }
            codeSplitArr.shift();
            const code = codeSplitArr.join('\n').trim();
            if (language === '') {
                language = title.split(':::active')[0].trim();
            }
            language = window.hljs.getLanguage(language) ? language : 'plaintext';
            codeResult.push({
                title: title,
                language: language,
                code: code
            });
        }
        return { result: true, code: codeResult };
    }

    static generateNewSyntax(tabs: codeTab[]): string {
        let result = '';
        for (const tab of tabs) {
            let title = tab.title;
            let active = '';

            // Extract active flag if present in title
            if (title.includes(':::active')) {
                title = title.replace(':::active', '').trim();
                active = ' | active';
            }

            let lang = tab.language;
            let header = `::: ${title}`;

            // Intelligent reconstruction: omit lang if it matches title inference
            const inferredLang = window.hljs.getLanguage(title) ? title.toLowerCase() : 'plaintext';
            // Only add lang if it's different from what would be inferred, OR if it's strictly different from plaintext/title match
            // To be safe and explicit, let's include it unless it perfectly matches inferred.
            if (lang !== inferredLang) {
                header += ` | ${lang}`;
            }

            header += active;
            result += `${header}\n${tab.code}\n\n`;
        }
        return result.trim();
    }
}
