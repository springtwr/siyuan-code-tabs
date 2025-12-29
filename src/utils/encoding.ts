import { newLineFlag } from "@/assets/constants";

/**
 * Encodes the source code using Base64 (UTF-8 safe).
 * @param code The source code string.
 * @returns Base64 encoded string.
 */
export function encodeSource(code: string): string {
    const encoder = new TextEncoder();
    const data = encoder.encode(code);
    let binary = '';
    const len = data.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(data[i]);
    }
    return window.btoa(binary);
}

/**
 * Decodes the stored source code string.
 * Supports backward compatibility: if the string contains the legacy newline flag,
 * it uses the old replacement method. Otherwise, it attempts Base64 decoding.
 * @param stored The string stored in the block attribute.
 * @returns The original source code string.
 */
export function decodeSource(stored: string): string {
    if (!stored) return "";

    // Legacy check: if it contains the old newline flag, use the old decoding method
    if (stored.includes(newLineFlag)) {
        return stored.replace(new RegExp(newLineFlag, 'g'), '\n');
    }

    // Try Base64 decoding
    try {
        const binary = window.atob(stored);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        const decoder = new TextDecoder();
        return decoder.decode(bytes);
    } catch (e) {
        // Fallback or error handling: return as is if decoding fails (e.g. plain text that doesn't trigger legacy check)
        return stored;
    }
}
