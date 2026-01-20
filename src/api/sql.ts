import {Block} from "@/types";
import {request} from "./request";

export async function sql(sql: string): Promise<any[]> {
    let sqldata = {
        stmt: sql,
    };
    let url = "/api/query/sql";
    return request(url, sqldata);
}

export async function getBlockByID(blockId: string): Promise<Block> {
    let sqlScript = `select * from blocks where id ='${blockId}'`;
    let data = await sql(sqlScript);
    return data[0];
}
