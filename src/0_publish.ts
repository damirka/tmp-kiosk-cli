// Replay TX: https://explorer.sui.io/txblock/4zrJnYC3EGcy7egnTdNyRZLdiXmrvkd1rTh65cByMkJB?network=devnet

import { TransactionBlock, fromB64, normalizeSuiObjectId } from "@mysten/sui.js";
import { fromHEX, toHEX } from "@mysten/bcs";
import { result } from "../res.json";
import { sender } from "./config";

const moduleMap = result.data.bcs.moduleMap;
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
].map((m) => [...fromHEX(toHEX(fromB64(m)).replace(/315ac5da29165a42932f911f8bd48cf9594671457c45488a3f93feceab7415a5/igm, '0'.padStart(64, '0')))]);

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
