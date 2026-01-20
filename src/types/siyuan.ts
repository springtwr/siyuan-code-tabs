/**
 * SiYuan Data Types
 */
export type DocumentId = string;
export type BlockId = string;
export type NotebookId = string;
export type PreviousID = BlockId;
export type ParentID = BlockId | DocumentId;

export type Notebook = {
    id: NotebookId;
    name: string;
    icon: string;
    sort: number;
    closed: boolean;
};

export type NotebookConf = {
    name: string;
    closed: boolean;
    refCreateSavePath: string;
    createDocNameTemplate: string;
    dailyNoteSavePath: string;
    dailyNoteTemplatePath: string;
};

export type BlockType = "d" | "s" | "h" | "t" | "i" | "p" | "f" | "audio" | "video" | "other";

export type BlockSubType =
    | "d1"
    | "d2"
    | "s1"
    | "s2"
    | "s3"
    | "t1"
    | "t2"
    | "h1"
    | "h2"
    | "h3"
    | "h4"
    | "h5"
    | "h6"
    | "table"
    | "task"
    | "toggle"
    | "latex"
    | "quote"
    | "html"
    | "code"
    | "footnote"
    | "cite"
    | "collection"
    | "bookmark"
    | "attachment"
    | "comment"
    | "mindmap"
    | "spreadsheet"
    | "calendar"
    | "image"
    | "audio"
    | "video"
    | "other";

export type Block = {
    id: BlockId;
    parent_id?: BlockId;
    root_id: DocumentId;
    hash: string;
    box: string;
    path: string;
    hpath: string;
    name: string;
    alias: string;
    memo: string;
    tag: string;
    content: string;
    fcontent?: string;
    markdown: string;
    length: number;
    type: BlockType;
    subtype: BlockSubType;
    ial?: string;
    sort: number;
    created: string;
    updated: string;
};

export type doOperation = {
    action: string;
    data: string;
    id: BlockId;
    parentID: BlockId | DocumentId;
    previousID: BlockId;
    retData: null;
};

/**
 * API Response interface
 */
export interface IResGetNotebookConf {
    box: string;
    conf: NotebookConf;
    name: string;
}

export interface IReslsNotebooks {
    notebooks: Notebook[];
}

export interface IResUpload {
    errFiles: string[];
    succMap: { [key: string]: string };
}

export interface IResdoOperations {
    doOperations: doOperation[];
    undoOperations: doOperation[] | null;
}

export interface IResGetBlockKramdown {
    id: BlockId;
    kramdown: string;
}

export interface IResGetChildBlock {
    id: BlockId;
    type: BlockType;
    subtype?: BlockSubType;
}

export interface IResGetTemplates {
    content: string;
    path: string;
}

export interface IResReadDir {
    isDir: boolean;
    isSymlink: boolean;
    name: string;
}

export interface IResExportMdContent {
    hPath: string;
    content: string;
}

export interface IResBootProgress {
    progress: number;
    details: string;
}

export interface IResForwardProxy {
    body: string;
    contentType: string;
    elapsed: number;
    headers: { [key: string]: string };
    status: number;
    url: string;
}

export interface IResExportResources {
    path: string;
}

declare global {
    interface Window {
        siyuan: {
            appearance: any;
            config: any;
            notebooks: any;
            menus: any;
            dialogs: any;
            blockPanels: any;
            storage: any;
            user: any;
            ws: any;
            languages: any;
        };
        pluginCodeTabs: any;
        hljs: any;
    }
}
