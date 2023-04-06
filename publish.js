const { mnemonic, address } = require('dist/src/config');
const { default: publishTx } = require('dist/src/0_publish');
const { default: setPricesTx } = require('dist/src/1_set_prices');
const { default: prepareTx } = require('dist/src/2_prepare');
const { default: mintCoinsTx } = require('dist/src/3_mint_coins');
const { default: addLiquidityTx } = require('dist/src/4_add_liquidity');

const sdk = require("@mysten/sui.js");
const keypair = sdk.Ed25519Keypair.deriveKeypair(process.env.MNEMONIC);
const provider = new sdk.JsonRpcProvider(new sdk.Connection(sdk.localnetConnection));
const signer = new sdk.RawSigner(keypair, provider);

(async () => {
  // publish the module
  let [pkg, objects] = await (async function() {
    const { objectChanges } = await signer.signAndExecuteTransactionBlock({
      transactionBlock: publishTx(),
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
    }).catch((err) => handleError(0, err));

    return [
      objectChanges.find((r) => r.type == "published").packageId,
      objectChanges.filter((r) => r.type == "created")
    ];
  })().catch((err) => handleError(0, err));

  // set prices
  let [] = await (async function () {
    const { effects } = await signer.signAndExecuteTransactionBlock({
      transactionBlock: setPricesTx(pkg, getShared(objects, "oracle::Oracle")),
      options: {
        showEffects: true,
      }
    }).catch((err) => handleError(1, err));
    console.log('Completed: publishTx');
    return [];
  })().catch((err) => handleError(1, err));

  // prepare pool
  let [] = await (async function () {
    const { objectChanges, effects } = await signer.signAndExecuteTransactionBlock({
      transactionBlock: prepareTx(
        pkg,
        getShared(objects, "pool::Global"),
        getOwned(objects, `TreasuryCap<${pkg}::tranche::TRANCHE>`)
      ),
      options: {
        showEffects: true,
        showObjectChanges: true,
      }
    }).catch((err) => handleError(2, err));
    console.log('Completed: prepareTx');
    return [
      objectChanges.filter((r) => r.type == "created")
    ];
  })().catch((err) => handleError(2, err));

  // mint coins tx
  let [coins] = await (async function () {
    const { effects, objectChanges } = await signer.signAndExecuteTransactionBlock({
      transactionBlock: mintCoinsTx(
        pkg,
        getOwned(objects, `TreasuryCap<${pkg}::btc::BTC>`),
        getOwned(objects, `TreasuryCap<${pkg}::eth::ETH>`),
        getOwned(objects, `TreasuryCap<${pkg}::usdt::USDT>`),
        getOwned(objects, `TreasuryCap<${pkg}::usdc::USDC`),
      ),
      options: {
        showEffects: true,
        showObjectChanges: true,
      }
    }).catch((err) => handleError(3, err));
    console.log('Completed: mintCoinsTx');
    return [
      objectChanges.filter((r) => r.type == "created")
    ];
  })().catch((err) => handleError(3, err));

  const liquiditySettings = [
    {
      coinType: `${pkg}::btc::BTC`,
      splitAmount: "1000000000",
      sourceCoin: getOwned(coins, `Coin<${pkg}::btc::BTC>`),
    },
    {
      coinType: `${pkg}::eth::ETH`,
      splitAmount: "20000000000",
      sourceCoin: getOwned(coins, `Coin<${pkg}::eth::ETH>`),
    },
    {
      coinType: `${pkg}::usdt::USDT`,
      splitAmount: "600000000000000",
      sourceCoin: getOwned(coins, `Coin<${pkg}::usdt::USDT>`),
    },
    {
      coinType: `${pkg}::usdc::USDC`,
      splitAmount: "100000000000000",
      sourceCoin: getOwned(coins, `Coin<${pkg}::usdc::USDC>`),
    }
  ];

  for (let { coinType, splitAmount, sourceCoin } of liquiditySettings) {
    console.log('Trying: addLiquidityTx for %s', coinType.split('::').slice(-1)[0]);
    await signer.signAndExecuteTransactionBlock({
      transactionBlock: addLiquidityTx(
        pkg,
        coinType,
        splitAmount,
        getShared(objects, "pool::Global"),
        getShared(objects, "oracle::Oracle"),
        sourceCoin
      ),
      options: {
        showEffects: true
      }
    }).catch((err) => handleError(`777 - ${coinType}`, err));
  }
})();

function getOwned(objects, type) {
  let obj = objects.filter((r) => r.objectType.includes(type))[0];
  return {
    objectId: obj.objectId,
    version: obj.version,
    digest: obj.digest
  };
}

function getShared(objects, type) {
  let obj = objects.filter((r) => r.objectType.includes(type))[0];
  return {
    objectId: obj.objectId,
    initialSharedVersion: obj.version,
    mutable: true
  };
}

function handleError(tag, err) {
  console.log('Operation: #%s failed', tag);
  console.log(err);
  console.log(JSON.stringify(err.message, null, 4));
  process.exit(1);
}
