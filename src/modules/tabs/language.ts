export function resolveLanguage(input: string): string {
    const normalized = (input ?? "").trim().toLowerCase();
    if (normalized === "markdown-render") return "markdown-render";
    if (!normalized) return "plaintext";
    // hljs 缺失时直接返回用户输入，避免解析阶段抛错
    if (!window.hljs?.getLanguage) return normalized;
    return window.hljs.getLanguage(normalized) ? normalized : "plaintext";
}