import { IResBootProgress } from "@/types";
import { request } from "./request";

export async function bootProgress(): Promise<IResBootProgress> {
    return request("/api/system/bootProgress", {});
}

export async function version(): Promise<string> {
    return request("/api/system/version", {});
}

export async function currentTime(): Promise<number> {
    return request("/api/system/currentTime", {});
}
