// Replay TX: https://explorer.sui.io/txblock/8Yz9L3W8otYoq6S8JLm3JNpxEfVh2ZNKWra5n5oaR4HQ?network=devnet

import { SuiAddress, SuiObjectRef, TransactionBlock } from "@mysten/sui.js";
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
    usdcCap: SuiObjectRef,
    bobby: SuiAddress,
    alice: SuiAddress,
) {
    const tx = new TransactionBlock();
    const bobbyAddr = tx.pure(bobby, "address");
    const aliceAddr = tx.pure(alice, "address");

    const mint = (cap: SuiObjectRef, type: string, amount: string, receiver: any) => tx.moveCall({
        target: `0x2::coin::mint_and_transfer`,
        typeArguments: [type],
        arguments: [
            tx.object({ Object: { ImmOrOwned: cap }}),
            tx.pure(amount, "u64"),
            // tx.pure(receiver, "address")
            receiver
        ]
    });

    mint(btcCap, `${pkg}::btc::BTC`, "1000000000", bobbyAddr);
    mint(ethCap, `${pkg}::eth::ETH`, "20000000000", bobbyAddr);
    mint(usdtCap, `${pkg}::usdt::USDT`, "600000000000000", bobbyAddr);
    mint(usdcCap, `${pkg}::usdc::USDC`, "100000000000000", bobbyAddr);

    // send to another account
    mint(usdtCap, `${pkg}::usdt::USDT`, "10000000000000", aliceAddr);
    mint(btcCap, `${pkg}::btc::BTC`, "100000000", aliceAddr);

    const [suiBob, suiAlice] = tx.splitCoins(tx.gas, [
        tx.pure("100000000000", "u64"),
        tx.pure("100000000000", "u64"),
    ]);

    tx.transferObjects([suiBob], bobbyAddr);
    tx.transferObjects([suiAlice], aliceAddr);

    return tx;
}
