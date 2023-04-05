const { mnemonic, address } = require('dist/src/config');
const { default: publish } = require('dist/src/0_publish');

const sdk = require("@mysten/sui.js");
const keypair = sdk.Ed25519Keypair.deriveKeypair(process.env.MNEMONIC);
const provider = new sdk.JsonRpcProvider(new sdk.Connection(sdk.localnetConnection));
const signer = new sdk.RawSigner(keypair, provider);

(async () => {
  console.log(publish);

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
      result.objectChanges.findAll((r) => r.type == "created")
    ];
  })();

  console.log(pkg, objects);
})();
