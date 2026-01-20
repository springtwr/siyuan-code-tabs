import {DocumentId, IResGetTemplates} from "@/types";
import {request} from "./request";

export async function render(id: DocumentId, path: string): Promise<IResGetTemplates> {
    let data = {
        id: id,
        path: path
    };
    let url = "/api/template/render";
    return request(url, data);
}

export async function renderSprig(template: string): Promise<string> {
    let url = "/api/template/renderSprig";
    return request(url, {template: template});
}
