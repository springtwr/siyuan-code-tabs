import {
    BlockId,
    DocumentId,
    IResGetBlockKramdown,
    IResGetChildBlock,
    IResdoOperations,
    ParentID,
    PreviousID,
} from "@/types";
import { request } from "./request";

type DataType = "markdown" | "dom";

export async function insertBlock(
    dataType: DataType,
    data: string,
    nextID?: BlockId,
    previousID?: BlockId,
    parentID?: BlockId
): Promise<IResdoOperations[]> {
    let payload = {
        dataType: dataType,
        data: data,
        nextID: nextID,
        previousID: previousID,
        parentID: parentID,
    };
    let url = "/api/block/insertBlock";
    return request(url, payload);
}

export async function prependBlock(
    dataType: DataType,
    data: string,
    parentID: BlockId | DocumentId
): Promise<IResdoOperations[]> {
    let payload = {
        dataType: dataType,
        data: data,
        parentID: parentID,
    };
    let url = "/api/block/prependBlock";
    return request(url, payload);
}

export async function appendBlock(
    dataType: DataType,
    data: string,
    parentID: BlockId | DocumentId
): Promise<IResdoOperations[]> {
    let payload = {
        dataType: dataType,
        data: data,
        parentID: parentID,
    };
    let url = "/api/block/appendBlock";
    return request(url, payload);
}

export async function updateBlock(
    dataType: DataType,
    data: string,
    id: BlockId
): Promise<IResdoOperations[]> {
    let payload = {
        dataType: dataType,
        data: data,
        id: id,
    };
    let url = "/api/block/updateBlock";
    return request(url, payload);
}

export async function deleteBlock(id: BlockId): Promise<IResdoOperations[]> {
    let data = {
        id: id,
    };
    let url = "/api/block/deleteBlock";
    return request(url, data);
}

export async function moveBlock(
    id: BlockId,
    previousID?: PreviousID,
    parentID?: ParentID
): Promise<IResdoOperations[]> {
    let data = {
        id: id,
        previousID: previousID,
        parentID: parentID,
    };
    let url = "/api/block/moveBlock";
    return request(url, data);
}

export async function foldBlock(id: BlockId) {
    let data = {
        id: id,
    };
    let url = "/api/block/foldBlock";
    return request(url, data);
}

export async function unfoldBlock(id: BlockId) {
    let data = {
        id: id,
    };
    let url = "/api/block/unfoldBlock";
    return request(url, data);
}

export async function getBlockKramdown(id: BlockId): Promise<IResGetBlockKramdown> {
    let data = {
        id: id,
    };
    let url = "/api/block/getBlockKramdown";
    return request(url, data);
}

export async function getChildBlocks(id: BlockId): Promise<IResGetChildBlock[]> {
    let data = {
        id: id,
    };
    let url = "/api/block/getChildBlocks";
    return request(url, data);
}

export async function transferBlockRef(fromID: BlockId, toID: BlockId, refIDs: BlockId[]) {
    let data = {
        fromID: fromID,
        toID: toID,
        refIDs: refIDs,
    };
    let url = "/api/block/transferBlockRef";
    return request(url, data);
}
