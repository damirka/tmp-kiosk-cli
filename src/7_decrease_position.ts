// Replay TX: https://explorer.sui.io/txblock/JDgFZSHmfer2qLSh1j1xDjzg44ocXJCqn3dzmqnwDa2m?network=devnet
// Replay TX: https://explorer.sui.io/txblock/GMm8m9CsYn9qU9Dh5RA2jmuMk3JS9TRpzMEhTDCbqYAR?network=devnet


import { SharedObjectRef, SuiAddress, SuiObjectRef, TransactionBlock, normalizeSuiObjectId } from "@mysten/sui.js";
import { sender } from "./config";

const inputs = [
    // pool::global
    // oracle::Oracle
    // amount ""
    // amount "0"
    // bool
    // address - sender
    // clock
];

export default function decreasePosition(
    pkg: string,
    amount: string,
    subAmount: string,
    flag: boolean,

    global: SharedObjectRef,
    oracle: SharedObjectRef,
    sender: SuiAddress,
    scenario: number,
) {
    const tx = new TransactionBlock();
    tx.setGasBudget(BigInt("20000000"));

    if (scenario === 0) {
        tx.moveCall({
            target: `${pkg}::pool::decrease_position`,
            typeArguments: [ `${pkg}::btc::BTC`, `${pkg}::btc::BTC` ],
            arguments: [
                tx.object({ Object: { Shared: global } }),
                tx.object({ Object: { Shared: oracle } }),
                tx.pure(amount),
                tx.pure(subAmount),
                tx.pure(flag, "bool"),
                tx.pure(sender, "address"),
                tx.object(normalizeSuiObjectId("0x6"))
            ]
        });
    }

    if (scenario === 1) {
        tx.moveCall({
            target: `${pkg}::pool::decrease_position`,
            typeArguments: [ `${pkg}::usdt::USDT`, `${pkg}::eth::ETH` ],
            arguments: [
                tx.object({ Object: { Shared: global } }),
                tx.object({ Object: { Shared: oracle } }),
                tx.pure(amount),
                tx.pure(subAmount),
                tx.pure(flag, "bool"),
                tx.pure(sender, "address"),
                tx.object(normalizeSuiObjectId("0x6"))
            ]
        });
    }

    return tx;
}
