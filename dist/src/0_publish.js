"use strict";
// Replay TX: https://explorer.sui.io/txblock/4zrJnYC3EGcy7egnTdNyRZLdiXmrvkd1rTh65cByMkJB?network=devnet
Object.defineProperty(exports, "__esModule", { value: true });
const sui_js_1 = require("@mysten/sui.js");
const res_json_1 = require("../res.json");
const config_1 = require("./config");
const modules = Object
    .values(res_json_1.result.data.bcs.moduleMap)
    .map((m) => [...(0, sui_js_1.fromB64)(m)]);
const dependencies = [
    (0, sui_js_1.normalizeSuiObjectId)("0x1"),
    (0, sui_js_1.normalizeSuiObjectId)("0x2"),
];
function publish() {
    const tx = new sui_js_1.TransactionBlock();
    const [uc] = tx.publish(modules, dependencies);
    tx.transferObjects([uc], tx.pure(config_1.sender, "address"));
    return tx;
}
exports.default = publish;
