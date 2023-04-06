// Replay TX: https://explorer.sui.io/txblock/8Yz9L3W8otYoq6S8JLm3JNpxEfVh2ZNKWra5n5oaR4HQ?network=devnet

import { SuiObjectRef, TransactionBlock } from "@mysten/sui.js";
import { sender } from "./config";

/**
 * pkg = SuiAddress
 * oracle: pkg::oracle::Oracle = SuiAddress
 */
export default function mintCoinsTx(
    pkg: string,
    btcCap: SuiObjectRef,
    ethCap: SuiObjectRef,
    usdtCap: SuiObjectRef,
    usdcCap: SuiObjectRef
) {
    const tx = new TransactionBlock();
    // another account which receives BTC and USDT
    const other = '0x6a5d0f84566e11ee210d9096f4fd26da1d5e655442388cf9902cd91b94d0f6e6';
    const mint = (cap: SuiObjectRef, type: string, amount: string, receiver: string = sender) => tx.moveCall({
        target: `0x2::coin::mint_and_transfer`,
        typeArguments: [type],
        arguments: [
            tx.object({ Object: {ImmOrOwned: cap }}),
            tx.pure(amount, "u64"),
            tx.pure(sender, "address")
        ]
    });

    mint(btcCap, `${pkg}::btc::BTC`, "1000000000", );
    mint(ethCap, `${pkg}::eth::ETH`, "20000000000");
    mint(usdtCap, `${pkg}::usdt::USDT`, "600000000000000");
    mint(usdcCap, `${pkg}::usdc::USDC`, "100000000000000");

    // send to another account
    mint(usdtCap, `${pkg}::usdt::USDT`, "10000000000000", other);
    mint(btcCap, `${pkg}::btc::BTC`, "100000000", other);

    return tx;
}
