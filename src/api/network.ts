import { IResForwardProxy } from "@/types";
import { request } from "./request";

export async function forwardProxy(
    url: string,
    method: string = "GET",
    payload: any = {},
    headers: any[] = [],
    timeout: number = 7000,
    contentType: string = "text/html"
): Promise<IResForwardProxy> {
    let data = {
        url: url,
        method: method,
        timeout: timeout,
        contentType: contentType,
        headers: headers,
        payload: payload,
    };
    let url1 = "/api/network/forwardProxy";
    return request(url1, data);
}
