// Replay TX: https://explorer.sui.io/txblock/Fy54JYL3b27Bw3JnLfCLZbdkg79Z1CafWc7xULD8FbQ6?network=devnet

import { SharedObjectRef, SuiAddress, TransactionBlock } from "@mysten/sui.js";

const inputs = (pkg: string) => [
    // first input is global address
    "100",
    "10000000",
    "5000000000000000000000000000000",
    "1000000",
    "3600",
    "100000000",
    "20000000",
    "20000000",
    "100000000",
    "100000000",
    "100000000",
    false,
    "30",
    false,
    "20",
    false,
    "3",
    true,
    "21",
    true,
    "21",
    // 0x79f4c834e6531c77a395b412a33a921a693be486c6f1e13758a3d9ffb03afd92,
    "1",
    "1",
    "1",
];

/**
 *
 * pkg = SuiAddress
 * global = 0x::pool::Global
 *
 */
// export default function set_prices(pkg: SuiAddress, global: SharedObjectRef) {
//     const tx = new TransactionBlock();
//     const setPrice = (type: string, price: string) => tx.moveCall({
//         target: `${pkg}::oracle::set_price`,
//         typeArguments: [type],
//         arguments: [
//             tx.object({ Object: { Shared: oracle }}),
//             tx.pure(type, "u256"),
//         ]
//     });

//     for (let [type, price] of inputs(pkg)) {
//         setPrice(type, price);
//     }

//     return tx;
// }
