// Replay TX: https://explorer.sui.io/txblock/Fy54JYL3b27Bw3JnLfCLZbdkg79Z1CafWc7xULD8FbQ6?network=devnet

import { SharedObjectRef, SuiAddress, SuiObjectRef, TransactionBlock } from "@mysten/sui.js";

const inputs = [
    null, // first input is global address
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
    null, // TreasuryCap<TRANCHE>
    "1",
    "1",
    "1",
];

/**
 * pkg = SuiAddress
 * global = 0x::pool::Global
 * trancheCap = 0x2::coin::TreasuryCap<0x::tranche::TRANCHE>
 */
export default function prepareTx(pkg: SuiAddress, global: SharedObjectRef, trancheCap: SuiObjectRef) {
    const tx = new TransactionBlock();
    const obj = tx.object({ Object: { Shared: global }});

    tx.moveCall({
        target: `${pkg}::pool::update_config`,
        arguments: [
            obj,
            tx.pure(inputs[1]),
            tx.pure(inputs[2]),
            tx.pure(inputs[3]),
            tx.pure(inputs[4]),
            tx.pure(inputs[5]),
            tx.pure(inputs[6]),
            tx.pure(inputs[7]),
            tx.pure(inputs[8]),
            tx.pure(inputs[9]),
            tx.pure(inputs[10]),
            tx.pure(inputs[11]),
        ]
    });

    tx.moveCall({
        target: `${pkg}::pool::add_token`,
        typeArguments: [`${pkg}::btc::BTC`],
        arguments: [
            obj,
            tx.pure(inputs[12]),
            tx.pure(inputs[13]),
        ]
    });

    tx.moveCall({
        target: `${pkg}::pool::add_token`,
        typeArguments: [`${pkg}::eth::ETH`],
        arguments: [
            obj,
            tx.pure(inputs[14]),
            tx.pure(inputs[15]),
        ]
    });

    tx.moveCall({
        target: `${pkg}::pool::add_token`,
        typeArguments: [`0x2::sui::SUI`],
        arguments: [
            obj,
            tx.pure(inputs[16]),
            tx.pure(inputs[17]),
        ]
    });

    tx.moveCall({
        target: `${pkg}::pool::add_token`,
        typeArguments: [`${pkg}::usdt::USDT`],
        arguments: [
            obj,
            tx.pure(inputs[18]),
            tx.pure(inputs[19]),
        ]
    });

    tx.moveCall({
        target: `${pkg}::pool::add_token`,
        typeArguments: [`${pkg}::usdc::USDC`],
        arguments: [
            obj,
            tx.pure(inputs[20]),
            tx.pure(inputs[21]),
        ]
    });

    tx.moveCall({
        target: `${pkg}::pool::add_tranche`,
        typeArguments: [`${pkg}::tranche::TRANCHE`],
        arguments: [
            obj, // TODO: check me twice
            tx.object({ Object: { ImmOrOwned: trancheCap }})
        ]
    });

    tx.moveCall({
        target: `${pkg}::pool::add_tranche_asset`,
        typeArguments: [`0x2::sui::SUI`, `${pkg}::tranche::TRANCHE`],
        arguments: [ obj ]
    });

    tx.moveCall({
        target: `${pkg}::pool::add_tranche_asset`,
        typeArguments: [`${pkg}::eth::ETH`, `${pkg}::tranche::TRANCHE`],
        arguments: [ obj ]
    });

    tx.moveCall({
        target: `${pkg}::pool::add_tranche_asset`,
        typeArguments: [`${pkg}::btc::BTC`, `${pkg}::tranche::TRANCHE`],
        arguments: [ obj ]
    });

    tx.moveCall({
        target: `${pkg}::pool::add_tranche_asset`,
        typeArguments: [`${pkg}::usdt::USDT`, `${pkg}::tranche::TRANCHE`],
        arguments: [ obj ]
    });

    tx.moveCall({
        target: `${pkg}::pool::add_tranche_asset`,
        typeArguments: [`${pkg}::usdc::USDC`, `${pkg}::tranche::TRANCHE`],
        arguments: [ obj ]
    });

    tx.moveCall({
        target: `${pkg}::pool::set_risk_factor`,
        typeArguments: [`${pkg}::btc::BTC`, `${pkg}::tranche::TRANCHE`],
        arguments: [ obj, tx.pure(inputs[23]) ]
    });

    tx.moveCall({
        target: `${pkg}::pool::set_risk_factor`,
        typeArguments: [`${pkg}::eth::ETH`, `${pkg}::tranche::TRANCHE`],
        arguments: [ obj, tx.pure(inputs[24]) ]
    });

    tx.moveCall({
        target: `${pkg}::pool::set_risk_factor`,
        typeArguments: [`0x2::sui::SUI`, `${pkg}::tranche::TRANCHE`],
        arguments: [ obj, tx.pure(inputs[25]) ]
    });

    return tx;
}
