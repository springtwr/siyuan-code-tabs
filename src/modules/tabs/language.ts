export function resolveLanguage(input: string): string {
    const normalized = normalizeLanguageInput(input);
    if (normalized === "markdown-render") return "markdown-render";
    if (!normalized) return "plaintext";
    // hljs 缺失时直接返回用户输入，避免解析阶段抛错
    if (!window.hljs?.getLanguage) return normalized;
    return window.hljs.getLanguage(normalized) ? normalized : "plaintext";
}

export function normalizeLanguageInput(input: string): string {
    const normalized = (input ?? "").trim().toLowerCase();
    if (!normalized) return "plaintext";
    return normalized;
}

export function isLanguageSupported(input: string): boolean {
    const normalized = normalizeLanguageInput(input);
    if (normalized === "markdown-render") return true;
    if (!window.hljs?.getLanguage) return true;
    return Boolean(window.hljs.getLanguage(normalized));
}
