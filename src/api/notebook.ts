import {Notebook, NotebookConf, NotebookId, IResGetNotebookConf, IReslsNotebooks} from "@/types";
import {request} from "./request";

export async function lsNotebooks(): Promise<IReslsNotebooks> {
    let url = "/api/notebook/lsNotebooks";
    return request(url, "");
}

export async function openNotebook(notebook: NotebookId) {
    let url = "/api/notebook/openNotebook";
    return request(url, {notebook: notebook});
}

export async function closeNotebook(notebook: NotebookId) {
    let url = "/api/notebook/closeNotebook";
    return request(url, {notebook: notebook});
}

export async function renameNotebook(notebook: NotebookId, name: string) {
    let url = "/api/notebook/renameNotebook";
    return request(url, {notebook: notebook, name: name});
}

export async function createNotebook(name: string): Promise<Notebook> {
    let url = "/api/notebook/createNotebook";
    return request(url, {name: name});
}

export async function removeNotebook(notebook: NotebookId) {
    let url = "/api/notebook/removeNotebook";
    return request(url, {notebook: notebook});
}

export async function getNotebookConf(notebook: NotebookId): Promise<IResGetNotebookConf> {
    let data = {notebook: notebook};
    let url = "/api/notebook/getNotebookConf";
    return request(url, data);
}

export async function setNotebookConf(notebook: NotebookId, conf: NotebookConf): Promise<NotebookConf> {
    let data = {notebook: notebook, conf: conf};
    let url = "/api/notebook/setNotebookConf";
    return request(url, data);
}
