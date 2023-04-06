// Replay TX: https://explorer.sui.io/txblock/TNaxsgJQrwGYN2SBRuGjE1sEiMuHfiCZVtJtbZK82Xz?network=devnet
// Replay TX: https://explorer.sui.io/txblock/GMm8m9CsYn9qU9Dh5RA2jmuMk3JS9TRpzMEhTDCbqYAR?network=devnet


import { SharedObjectRef, SuiAddress, SuiObjectRef, TransactionBlock, normalizeSuiObjectId } from "@mysten/sui.js";
import { sender } from "./config";

export default function increasePosition(
    pkg: string,
    btcSource: SuiObjectRef,
    usdtSource: SuiObjectRef,

    global: SharedObjectRef,
    oracle: SharedObjectRef,
    scenario: number
) {
    const tx = new TransactionBlock();
    tx.setGasBudget(BigInt("20000000"));

    if (scenario === 0) {
        const [ btcCoin ] = tx.splitCoins(
            tx.object({ Object: { ImmOrOwned: btcSource }}), [
                tx.pure(BigInt("100000000"))
            ]
        );

        tx.moveCall({
            target: `${pkg}::pool::increase_position`,
            typeArguments: [ `${pkg}::btc::BTC`, `${pkg}::btc::BTC` ],
            arguments: [
                tx.object({ Object: { Shared: global } }),
                tx.object({ Object: { Shared: oracle } }),
                btcCoin,
                tx.pure(BigInt("60000000000000000000000000000000000")),
                tx.pure(true, "bool"),
                tx.object(normalizeSuiObjectId("0x6"))
            ]
        });
    }

    if (scenario === 1) {
        const [ usdtCoin ] = tx.splitCoins(
            tx.object({ Object: { ImmOrOwned: usdtSource }}), [
                tx.pure("1000000000000")
            ]
        );

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
    }

    return tx;
}
