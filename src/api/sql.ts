import { Block } from "@/types";
import { request } from "./request";

export async function sql(sql: string): Promise<unknown[]> {
    let sqldata = {
        stmt: sql,
    };
    let url = "/api/query/sql";
    return request(url, sqldata);
}

export async function getBlockByID(blockId: string): Promise<Block | undefined> {
    let sqlScript = `select * from blocks where id ='${blockId}'`;
    let data = (await sql(sqlScript)) as Block[];
    return data[0];
}
