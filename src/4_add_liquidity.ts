// Replay TX: https://explorer.sui.io/txblock/CknZHV4m5TfMV27264ic5sBZRfzXa1EkuuU2AvgsGqfM?network=devnet

import { SharedObjectRef, SuiObjectRef, TransactionBlock, normalizeSuiObjectId } from "@mysten/sui.js";
import { sender } from "./config";

/**
 * pkg = SuiAddress
 * oracle: pkg::oracle::Oracle = SuiAddress
 */
export default function addLiquidity(
    pkg: string,
    coinType: string,
    splitAmount: string,
    global: SharedObjectRef,
    oracle: SharedObjectRef,
    sourceCoin: SuiObjectRef,
) {
    const tx = new TransactionBlock();
    const source = tx.object({ Object: { ImmOrOwned: sourceCoin }});
    const [ split ] = tx.splitCoins(source, [ tx.pure(splitAmount, "u64") ]);

    tx.moveCall({
        target: `${pkg}::pool::add_liquidity`,
        typeArguments: [ coinType, `${pkg}::tranche::TRANCHE` ],
        arguments: [
            tx.object({ Object: { Shared: global }}),
            tx.object({ Object: { Shared: oracle }}),
            split,
            tx.pure("0", "u256"),
            tx.pure(sender, "address"),
            tx.object(normalizeSuiObjectId("0x6"))
        ]
    });

    return tx;
}
