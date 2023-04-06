// Replay TX: https://explorer.sui.io/txblock/Fy54JYL3b27Bw3JnLfCLZbdkg79Z1CafWc7xULD8FbQ6?network=devnet

import { SharedObjectRef, TransactionBlock } from "@mysten/sui.js";

/**
 * pkg = SuiAddress
 * oracle: pkg::oracle::Oracle = SuiAddress
 */
export default function setPricesTx(pkg: string, oracle: SharedObjectRef) {
    const tx = new TransactionBlock();
    const obj = tx.object({ Object: { Shared: oracle }});

    const setPrice = (type: string, price: bigint) => tx.moveCall({
        target: `${pkg}::oracle::set_price`,
        typeArguments: [type],
        arguments: [ obj, tx.pure(price, "u256") ]
    });

    setPrice(`${pkg}::btc::BTC`, BigInt("330000000000000000000000000"));
    setPrice(`${pkg}::eth::ETH`, BigInt("2400000000000000000000000"));

    return tx;
}
