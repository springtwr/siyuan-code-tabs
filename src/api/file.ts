import { fetchSyncPost } from "siyuan";
import {
    BlockId,
    DocumentId,
    IResExportMdContent,
    IResExportResources,
    IResReadDir,
    IResUpload,
    NotebookId,
} from "@/types";
import { request } from "./request";

export async function createDocWithMd(
    notebook: NotebookId,
    path: string,
    markdown: string
): Promise<DocumentId> {
    let data = {
        notebook: notebook,
        path: path,
        markdown: markdown,
    };
    let url = "/api/filetree/createDocWithMd";
    return request(url, data);
}

export async function renameDoc(
    notebook: NotebookId,
    path: string,
    title: string
): Promise<DocumentId> {
    let data = {
        doc: notebook,
        path: path,
        title: title,
    };
    let url = "/api/filetree/renameDoc";
    return request(url, data);
}

export async function removeDoc(notebook: NotebookId, path: string) {
    let data = {
        notebook: notebook,
        path: path,
    };
    let url = "/api/filetree/removeDoc";
    return request(url, data);
}

export async function moveDocs(fromPaths: string[], toNotebook: NotebookId, toPath: string) {
    let data = {
        fromPaths: fromPaths,
        toNotebook: toNotebook,
        toPath: toPath,
    };
    let url = "/api/filetree/moveDocs";
    return request(url, data);
}

export async function getHPathByPath(notebook: NotebookId, path: string): Promise<string> {
    let data = {
        notebook: notebook,
        path: path,
    };
    let url = "/api/filetree/getHPathByPath";
    return request(url, data);
}

export async function getHPathByID(id: BlockId): Promise<string> {
    let data = {
        id: id,
    };
    let url = "/api/filetree/getHPathByID";
    return request(url, data);
}

export async function getIDsByHPath(notebook: NotebookId, path: string): Promise<BlockId[]> {
    let data = {
        notebook: notebook,
        path: path,
    };
    let url = "/api/filetree/getIDsByHPath";
    return request(url, data);
}

export async function upload(assetsDirPath: string, files: any[]): Promise<IResUpload> {
    let form = new FormData();
    form.append("assetsDirPath", assetsDirPath);
    for (let file of files) {
        form.append("file[]", file);
    }
    let url = "/api/asset/upload";
    return request(url, form);
}

export async function getFile(path: string): Promise<any> {
    let data = {
        path: path,
    };
    let url = "/api/file/getFile";
    try {
        let file = await fetchSyncPost(url, data);
        return file;
    } catch (error_msg) {
        return null;
    }
}

export async function putFile(path: string, isDir: boolean, file: any) {
    let form = new FormData();
    form.append("path", path);
    form.append("isDir", isDir.toString());
    // Copyright (c) 2023, terwer.
    // https://github.com/terwer/siyuan-plugin-importer/blob/v1.4.1/src/api/kernel-api.ts
    form.append("modTime", Math.floor(Date.now()).toString());
    form.append("file", file);
    let url = "/api/file/putFile";
    return request(url, form);
}

export async function removeFile(path: string) {
    let data = {
        path: path,
    };
    let url = "/api/file/removeFile";
    return request(url, data);
}

export async function readDir(path: string): Promise<IResReadDir> {
    let data = {
        path: path,
    };
    let url = "/api/file/readDir";
    return request(url, data);
}

export async function exportMdContent(id: DocumentId): Promise<IResExportMdContent> {
    let data = {
        id: id,
    };
    let url = "/api/export/exportMdContent";
    return request(url, data);
}

export async function exportResources(paths: string[], name: string): Promise<IResExportResources> {
    let data = {
        paths: paths,
        name: name,
    };
    let url = "/api/export/exportResources";
    return request(url, data);
}

export type PandocArgs = string;

export async function pandoc(args: PandocArgs[]) {
    let data = {
        args: args,
    };
    let url = "/api/convert/pandoc";
    return request(url, data);
}
