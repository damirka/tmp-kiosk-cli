// Replay TX (1): https://explorer.sui.io/txblock/4zrJnYC3EGcy7egnTdNyRZLdiXmrvkd1rTh65cByMkJB?network=devnet

import { TransactionBlock, fromB64, normalizeSuiObjectId } from "@mysten/sui.js";
import { fromHEX, toHEX } from "@mysten/bcs";
import { result as first } from "../res.json";
import { result as second } from "../res_2.json";
import { sender } from "./config";

const moduleMap = second.data.bcs.moduleMap;
const modules = [
    moduleMap.signed_int,
    moduleMap.position_utils,
    moduleMap.usdc,
    moduleMap.usdt,
    moduleMap.eth,
    moduleMap.btc,
    moduleMap.oracle,
    moduleMap.math_utils,
    moduleMap.tranche,
    moduleMap.pool,
].map((m) => [...fromHEX(toHEX(fromB64(m)).replace(/e9b5aaf6090fe148fae86653679af64b866f43964ebc387fc03ab1d37d3a0b44/igm, '0'.padStart(64, '0')))]);

const dependencies = [
    normalizeSuiObjectId("0x1"),
    normalizeSuiObjectId("0x2"),
];

export default function publish() {
    const tx = new TransactionBlock();
    const [uc] = tx.publish(modules, dependencies);
    tx.transferObjects([uc], tx.pure(sender, "address"));
    return tx;
}
