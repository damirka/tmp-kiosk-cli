"use strict";
// Replay TX: https://explorer.sui.io/txblock/Fy54JYL3b27Bw3JnLfCLZbdkg79Z1CafWc7xULD8FbQ6?network=devnet
Object.defineProperty(exports, "__esModule", { value: true });
const sui_js_1 = require("@mysten/sui.js");
const inputs = (pkg) => [
    // first input is oracle address
    [`${pkg}::btc::BTC`, '300000000000000000000000000'],
    [`${pkg}::eth::ETH`, '2000000000000000000000000'],
    [`0x2::sui::SUI`, '400000000000000000000000'],
    [`${pkg}::usdt::USDT`, '1000000000000000000000'],
    [`${pkg}::usdc::USDC`, '1000000000000000000000']
];
function set_prices(pkg, oracle) {
    const tx = new sui_js_1.TransactionBlock();
    const setPrice = (type, price) => tx.moveCall({
        target: `${pkg}::oracle::set_price`,
        typeArguments: [type],
        arguments: [
            tx.object({ Object: { Shared: oracle } }),
            tx.pure(type, "u256"),
        ]
    });
    for (let [type, price] of inputs(pkg)) {
        setPrice(type, price);
    }
    return tx;
}
exports.default = set_prices;
