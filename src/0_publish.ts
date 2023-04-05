// Replay TX: https://explorer.sui.io/txblock/4zrJnYC3EGcy7egnTdNyRZLdiXmrvkd1rTh65cByMkJB?network=devnet

import { TransactionBlock, fromB64, normalizeSuiObjectId } from "@mysten/sui.js";
import { result } from "../res.json";
import { sender } from "./config";

const modules = Object
    .values(result.data.bcs.moduleMap)
    .map((m) => [...fromB64(m)]);

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
