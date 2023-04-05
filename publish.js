const { mnemonic, address } = require('dist/src/config');
const { default: publish } = require('dist/src/0_publish');
const { default: set_prices } = require('dist/src/1_set_prices');

const sdk = require("@mysten/sui.js");
const keypair = sdk.Ed25519Keypair.deriveKeypair(process.env.MNEMONIC);
const provider = new sdk.JsonRpcProvider(new sdk.Connection(sdk.localnetConnection));
const signer = new sdk.RawSigner(keypair, provider);

(async () => {
  // publish the module
  let [pkg, objects] = await (async function() {
    const result = await signer.signAndExecuteTransactionBlock({
      transactionBlock: publish(),
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
    });

    return [
      result.objectChanges.find((r) => r.type == "published").packageId,
      result.objectChanges.filter((r) => r.type == "created")
    ];
  })();

  let [] = await (async function () {

    const { effects } = signer.signAndExecuteTransactionBlock({
      transactionBlock: set_prices(pkg, getShared(objects, "oracle::Oracle")),
      options: {
        showEffects: true,
      }
    })

    console.log(effects);

    return [];
  })();


})();


function getShared(objects, type) {
  let obj = objects.filter((r) => r.objectType.includes(type))[0];
  return {
    objectId: obj.objectId,
    initialSharedVersion: obj.version,
    mutable: true
  };
}
