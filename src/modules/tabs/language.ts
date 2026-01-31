/**
 * 解析输入语言并回退到可用语言。
 * 兼容：`hljs` 缺失时直接返回用户输入。
 */
export function resolveLanguage(input: string): string {
    const normalized = normalizeLanguageInput(input);
    if (normalized === "markdown-render") return "markdown-render";
    if (!normalized) return "plaintext";
    // hljs 缺失时直接返回用户输入，避免解析阶段抛错
    if (!window.hljs?.getLanguage) return normalized;
    return window.hljs.getLanguage(normalized) ? normalized : "plaintext";
}

/**
 * 仅做语言输入的规范化，不负责校验支持性。
 */
export function normalizeLanguageInput(input: string): string {
    const normalized = (input ?? "").trim().toLowerCase();
    if (!normalized) return "plaintext";
    return normalized;
}

/**
 * 判断语言是否支持高亮。
 * 注意：`hljs` 未加载时视为“可用”。
 */
export function isLanguageSupported(input: string): boolean {
    const normalized = normalizeLanguageInput(input);
    if (normalized === "markdown-render") return true;
    if (!window.hljs?.getLanguage) return true;
    return Boolean(window.hljs.getLanguage(normalized));
}
