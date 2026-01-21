import { BlockId } from "@/types";
import { request } from "./request";

export async function setBlockAttrs(id: BlockId, attrs: { [key: string]: string }) {
    let data = {
        id: id,
        attrs: attrs,
    };
    let url = "/api/attr/setBlockAttrs";
    return request(url, data);
}

export async function getBlockAttrs(id: BlockId): Promise<{ [key: string]: string }> {
    let data = {
        id: id,
    };
    let url = "/api/attr/getBlockAttrs";
    return request(url, data);
}
