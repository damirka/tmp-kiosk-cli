// Replay TX: https://explorer.sui.io/txblock/Fy54JYL3b27Bw3JnLfCLZbdkg79Z1CafWc7xULD8FbQ6?network=devnet

import { SharedObjectRef, TransactionBlock } from "@mysten/sui.js";

const inputs = (pkg: string) => [
    // first input is oracle address
    [`${pkg}::btc::BTC`, '300000000000000000000000000'],
    [`${pkg}::eth::ETH`, '2000000000000000000000000'],
    [`0x2::sui::SUI`, '400000000000000000000000'],
    [`${pkg}::usdt::USDT`, '1000000000000000000000'],
    [`${pkg}::usdc::USDC`, '1000000000000000000000']
];

/**
 * pkg = SuiAddress
 * oracle: pkg::oracle::Oracle = SuiAddress
 */
export default function set_prices(pkg: string, oracle: SharedObjectRef) {
    const tx = new TransactionBlock();
    const obj = tx.object({ Object: { Shared: oracle }});

    const setPrice = (type: string, price: string) => tx.moveCall({
        target: `${pkg}::oracle::set_price`,
        typeArguments: [type],
        arguments: [ obj, tx.pure(price, "u256") ]
    });

    for (let [type, price] of inputs(pkg)) {
        setPrice(type, price);
    }

    return tx;
}
