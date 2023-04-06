const { mnemonic, address } = require("dist/src/config");
const { default: publishTx } = require("dist/src/0_publish");
const { default: setPricesTx } = require("dist/src/1_set_prices");
const { default: prepareTx } = require("dist/src/2_prepare");
const { default: mintCoinsTx } = require("dist/src/3_mint_coins");
const { default: addLiquidityTx } = require("dist/src/4_add_liquidity");
const { default: increasePositionTx } = require("dist/src/5_increase_position");
const { default: updatePricesTx } = require("dist/src/6_update_prices");
const { default: decreasePositionTx } = require("dist/src/7_decrease_position");

const sdk = require("@mysten/sui.js");
const provider = new sdk.JsonRpcProvider(
  new sdk.Connection(sdk.localnetConnection)
);

const admin = new sdk.RawSigner(sdk.Ed25519Keypair.deriveKeypair(mnemonic), provider);
const alice = new sdk.RawSigner(sdk.Ed25519Keypair.generate(), provider);
const bobby = new sdk.RawSigner(sdk.Ed25519Keypair.generate(), provider);

(async () => {
  const bobbyAddress = await bobby.getAddress();
  const aliceAddress = await alice.getAddress();

  // publish the module
  let [pkg, objects] = await (async function () {
    const { objectChanges } = await admin
      .signAndExecuteTransactionBlock({
        transactionBlock: publishTx(),
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      })
      .catch((err) => handleError(0, err));

    return [
      objectChanges.find((r) => r.type == "published").packageId,
      objectChanges.filter((r) => r.type == "created"),
    ];
  })().catch((err) => handleError(0, err));

  // set prices
  let [] = await (async function () {
    const { effects } = await admin
      .signAndExecuteTransactionBlock({
        transactionBlock: setPricesTx(
          pkg,
          getShared(objects, "oracle::Oracle")
        ),
        options: {
          showEffects: true,
        },
      })
      .catch((err) => handleError(1, err));
    console.log("Completed: publishTx");
    console.log("Effects:", JSON.stringify(effects.status));
    return [];
  })().catch((err) => handleError(1, err));

  // prepare pool
  let [] = await (async function () {
    const { objectChanges, effects } = await admin
      .signAndExecuteTransactionBlock({
        transactionBlock: prepareTx(
          pkg,
          getShared(objects, "pool::Global"),
          getOwned(objects, `TreasuryCap<${pkg}::tranche::TRANCHE>`),
        ),
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      })
      .catch((err) => handleError(2, err));
    console.log("Completed: prepareTx");
    console.log("Effects:", JSON.stringify(effects.status));
    return [objectChanges.filter((r) => r.type == "created")];
  })().catch((err) => handleError(2, err));

  // mint coins tx
  let [coins, mutatedCaps] = await (async function () {
    const { effects, objectChanges } = await admin
      .signAndExecuteTransactionBlock({
        transactionBlock: mintCoinsTx(
          pkg,
          getOwned(objects, `TreasuryCap<${pkg}::btc::BTC>`),
          getOwned(objects, `TreasuryCap<${pkg}::eth::ETH>`),
          getOwned(objects, `TreasuryCap<${pkg}::usdt::USDT>`),
          getOwned(objects, `TreasuryCap<${pkg}::usdc::USDC`),
          bobbyAddress,
          aliceAddress
        ),
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      }, 'WaitForLocalExecution')
      .catch((err) => handleError(3, err));
    console.log("Completed: mintCoinsTx");
    console.log("Effects:", JSON.stringify(effects.status));
    return [
      objectChanges.filter((r) => r.type == "created"),
      objectChanges.filter((r) => r.type == "mutated"),
      objectChanges.filter((r) => r.type == "transferred")
    ];
  })().catch((err) => handleError(3, err));

  const bobCoins = coins.filter((r) => r.owner.AddressOwner == bobbyAddress);
  const aliceCoins = coins.filter((r) => r.owner.AddressOwner == aliceAddress);
  const liquiditySettings = [
    {
      coinType: `${pkg}::btc::BTC`,
      splitAmount: "1000000000",
      sourceCoin: getOwned(bobCoins, `0x2::coin::Coin<${pkg}::btc::BTC>`),
    },
    {
      coinType: `${pkg}::eth::ETH`,
      splitAmount: "20000000000",
      sourceCoin: getOwned(bobCoins, `0x2::coin::Coin<${pkg}::eth::ETH>`),
    },
    {
      coinType: `${pkg}::usdt::USDT`,
      splitAmount: "600000000000000",
      sourceCoin: getOwned(bobCoins, `0x2::coin::Coin<${pkg}::usdt::USDT>`),
    },
    {
      coinType: `${pkg}::usdc::USDC`,
      splitAmount: "100000000000000",
      sourceCoin: getOwned(bobCoins, `0x2::coin::Coin<${pkg}::usdc::USDC>`),
    },
  ];

  for (let { coinType, splitAmount, sourceCoin } of liquiditySettings) {
    console.log(
      "Trying: addLiquidityTx for %s",
      coinType.split("::").slice(-1)[0]
    );
    const { effects } = await bobby
      .signAndExecuteTransactionBlock({
        transactionBlock: addLiquidityTx(
          pkg,
          coinType,
          splitAmount,
          getShared(objects, "pool::Global"),
          getShared(objects, "oracle::Oracle"),
          sourceCoin
        ),
        options: {
          showEffects: true,
        },
      })
      .catch((err) => handleError(`777 - ${coinType}`, err));
      console.log("Effects:", JSON.stringify(effects.status));
  }

  let [] = await (async function () {
    const { effects, objectChanges } = await bobby
      .signAndExecuteTransactionBlock({
        transactionBlock: increasePositionTx(
          pkg,
          // getOwned(mutatedCaps, `TreasuryCap<${pkg}::btc::BTC>`),
          // getOwned(mutatedCaps, `TreasuryCap<${pkg}::usdt::USDT>`),
          getShared(objects, `${pkg}::pool::Global`),
          getShared(objects, `${pkg}::oracle::Oracle`),
          0
        ),
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      })
      .catch((err) => handleError(5, err));
    console.log("Completed: increasePositionTx: BTC");
    console.log("Effects:", JSON.stringify(effects.status));
    return [
      // objectChanges.filter((r) => r.type == "created"),
      // objectChanges.filter((r) => r.type == "mutated"),
    ];
  })().catch((err) => handleError(5, err));

  let [] = await (async function () {
    const { effects, objectChanges } = await alice
      .signAndExecuteTransactionBlock({
        transactionBlock: increasePositionTx(
          pkg,
          getOwned(aliceCoins, `${pkg}::btc::BTC`),
          getOwned(aliceCoins, `${pkg}::usdt::USDT`),
          getShared(objects, `${pkg}::pool::Global`),
          getShared(objects, `${pkg}::oracle::Oracle`),
          1
        ),
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      })
      .catch((err) => handleError(6, err));
    console.log("Completed: increasePositionTx: USDT/ETH");
    console.log("Effects:", JSON.stringify(effects.status));
    return [
      // objectChanges.filter((r) => r.type == "created"),
      // objectChanges.filter((r) => r.type == "mutated"),
    ];
  })().catch((err) => handleError(6, err));

  let [] = await (async function () {
    const { effects, objectChanges } = await admin
      .signAndExecuteTransactionBlock({
        transactionBlock: updatePricesTx(
          pkg,
          getShared(objects, `${pkg}::oracle::Oracle`)
        ),
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      })
      .catch((err) => handleError(7, err));
    console.log("Completed: updatePricesTx");
    console.log("Effects:", JSON.stringify(effects.status));
    return [
      // objectChanges.filter((r) => r.type == "created"),
      // objectChanges.filter((r) => r.type == "mutated"),
    ];
  })().catch((err) => handleError(7, err));

  // decreasePositionTx
  let [] = await (async function () {
    const { effects, objectChanges } = await alice
      .signAndExecuteTransactionBlock({
        transactionBlock: decreasePositionTx(
          pkg,
          "10000000",
          "0",
          true,
          getShared(objects, `${pkg}::pool::Global`),
          getShared(objects, `${pkg}::oracle::Oracle`),
          aliceAddress,
          0
        ),
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      })
      .catch((err) => handleError(8, err));
    console.log("Completed: decreasePositionTx: BTC");
    console.log("Effects:", JSON.stringify(effects.status));
    return [
      // objectChanges.filter((r) => r.type == "created"),
      // objectChanges.filter((r) => r.type == "mutated"),
    ];
  })().catch((err) => handleError(8, err));

  let [] = await (async function () {
    const { effects, objectChanges } = await alice
      .signAndExecuteTransactionBlock({
        transactionBlock: decreasePositionTx(
          pkg,
          "0",
          "200000000000000000000000000000000",
          false,
          getShared(objects, `${pkg}::pool::Global`),
          getShared(objects, `${pkg}::oracle::Oracle`),
          aliceAddress,
          1
        ),
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      })
      .catch((err) => handleError(9, err));
    console.log("Completed: decreasePositionTx: USDT/ETH");
    console.log("Effects:", JSON.stringify(effects.status));
    return [
      // objectChanges.filter((r) => r.type == "created"),
      // objectChanges.filter((r) => r.type == "mutated"),
    ];
  })().catch((err) => handleError(9, err));
})();

function getOwned(objects, type) {
  let obj = objects.filter((r) => r.objectType.includes(type))[0];
  return {
    objectId: obj.objectId,
    version: obj.version,
    digest: obj.digest,
  };
}

function getShared(objects, type) {
  let obj = objects.filter((r) => r.objectType.includes(type))[0];
  return {
    objectId: obj.objectId,
    initialSharedVersion: obj.version,
    mutable: true,
  };
}

function handleError(tag, err) {
  console.log("Operation: #%s failed", tag);
  console.log(err);
  console.log(JSON.stringify(err.message, null, 4));
  process.exit(1);
}
