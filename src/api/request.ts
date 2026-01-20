import { fetchSyncPost, IWebSocketData } from "siyuan";

export async function request<T = unknown>(url: string, data: unknown): Promise<T> {
    let response: IWebSocketData = await fetchSyncPost(url, data);
    if (response.code !== 0) {
        const errorMsg = response.msg || "Unknown API error";
        throw new Error(`[API ${url}] ${errorMsg} (code: ${response.code})`);
    }
    return response.data;
}
