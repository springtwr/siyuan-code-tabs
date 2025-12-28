import { pushMsg } from "@/api";
import hljs from "highlight.js";
import { codeTab } from "@/types";

export class TabParser {
    static checkCodeText(codeText: string, i18n: any): { result: boolean, code: codeTab[] } {
        // 标签需要以tab:::开头，且开头不能有空格
        codeText = codeText.trim();
        if (codeText.startsWith('tab:::')) {
            // 用正则分割代码
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
                language = hljs.getLanguage(language) ? language : 'plaintext';
                codeResult.push({
                    title: title,
                    language: language,
                    code: code
                });
            }
            return { result: true, code: codeResult }
        } else {
            pushMsg(i18n.headErrWhenCheckCode).then();
            return { result: false, code: [] }
        }
    }
}
