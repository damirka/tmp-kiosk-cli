// Replay TX: https://explorer.sui.io/txblock/TNaxsgJQrwGYN2SBRuGjE1sEiMuHfiCZVtJtbZK82Xz?network=devnet
// Replay TX: https://explorer.sui.io/txblock/GMm8m9CsYn9qU9Dh5RA2jmuMk3JS9TRpzMEhTDCbqYAR?network=devnet


import { SharedObjectRef, SuiAddress, SuiObjectRef, TransactionBlock, normalizeSuiObjectId } from "@mysten/sui.js";
import { sender } from "./config";

export default function increasePosition(
    pkg: string,
    btcCap: SuiObjectRef,
    usdtCap: SuiObjectRef,

    global: SharedObjectRef,
    oracle: SharedObjectRef,
) {
    const tx = new TransactionBlock();
    const [ btcCoin ] = tx.moveCall({
        target: `0x2::coin::mint`,
        typeArguments: [ `${pkg}::btc::BTC` ],
        arguments: [
            tx.object({ Object: { ImmOrOwned: btcCap }}),
            tx.pure("100000000")
        ]
    });

    tx.setGasBudget(BigInt("20000000"));
    tx.moveCall({
        target: `${pkg}::pool::increase_position`,
        typeArguments: [ `${pkg}::btc::BTC`, `${pkg}::btc::BTC` ],
        arguments: [
            tx.object({ Object: { Shared: global } }),
            tx.object({ Object: { Shared: oracle } }),
            btcCoin,
            tx.pure("60000000000000000000000000000000000"),
            tx.pure(true, "bool"),
            tx.object(normalizeSuiObjectId("0x6"))
        ]
    });

    const [ usdtCoin ] = tx.moveCall({
        target: `0x2::coin::mint`,
        typeArguments: [ `${pkg}::usdt::USDT` ],
        arguments: [
            tx.object({ Object: { ImmOrOwned: usdtCap }}),
            tx.pure("100000000")
        ]
    });

    tx.moveCall({
        target: `${pkg}::pool::increase_position`,
        typeArguments: [ `${pkg}::usdt::USDT`, `${pkg}::eth::ETH` ],
        arguments: [
            tx.object({ Object: { Shared: global } }),
            tx.object({ Object: { Shared: oracle } }),
            usdtCoin,
            tx.pure("3000000000000000000000000000000000"),
            tx.pure(false, "bool"),
            tx.object(normalizeSuiObjectId("0x6"))
        ]
    });

    return tx;
}
