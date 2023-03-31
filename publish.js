const sdk = require("@mysten/sui.js");
const { execSync } = require("child_process");
const path = require("path");
const packagePath = path.resolve(__dirname);

if (!process.env.MNEMONIC) {
  console.log('Requires MNEMONIC; set with `export MNEMONIC="..."`');
  process.exit(1);
}

const keypair = sdk.Ed25519Keypair.deriveKeypair(process.env.MNEMONIC);
const provider = new sdk.JsonRpcProvider(new sdk.Connection({ fullnode: 'https://fullnode.testnet.sui.io/' }));
const signer = new sdk.RawSigner(keypair, provider);

const compiledModulesAndDeps = JSON.parse(
  execSync(`sui move build --dump-bytecode-as-base64 --path ${packagePath}`, {
    encoding: "utf-8",
  })
);

(async () => {
  // publish the module
  let [_pkg, publisher, item, itemType] = await (async function publish() {
    const tx = new sdk.TransactionBlock();
    const [upgradeCap] = tx.publish(
      compiledModulesAndDeps.modules.map((m) => Array.from(sdk.fromB64(m))),
      compiledModulesAndDeps.dependencies.map((addr) =>
        sdk.normalizeSuiObjectId(addr)
      )
    );

    tx.transferObjects([upgradeCap], tx.pure(await signer.getAddress()));

    const result = await signer.signAndExecuteTransactionBlock(
      {
        transactionBlock: tx,
        options: {
          showEffects: true,
          showObjectChanges: true,
          showEvents: true,
        },
      },
      "WaitForLocalExecution"
    );

    // console.log(JSON.stringify(result, null, 4));

    let chg = result.objectChanges;
    let item = chg.find((r) => r.type == "created" && r.objectType.includes("Item"));

    return [
      chg.find((r) => r.type == "published").packageId,
      chg.find((r) => r.type == "created" && r.objectType.includes("Publisher")).objectId,
      item.objectId,
      item.objectType
    ];
  })();

  // wait for some time - fn needs to fetch coin changes
  await require("util").promisify(setTimeout)(10000);

  console.log('create a kiosk, policy and place an item');

  const [kiosk, policy] = await (async function kiosk() {
    const tx = new sdk.TransactionBlock();
    const [kiosk, kiosk_cap] = tx.moveCall({ target: `0x2::kiosk::new` });
    tx.moveCall({
      target: `0x2::kiosk::place_and_list`,
      typeArguments: [itemType],
      arguments: [
        kiosk,
        kiosk_cap,
        tx.object(item),
        tx.pure(100000, 'u64')
      ]
    });

    let [policy, policy_cap] = tx.moveCall({
      target: `0x2::transfer_policy::new`,
      typeArguments: [itemType],
      arguments: [ tx.object(publisher) ]
    });

    tx.transferObjects([policy_cap, kiosk_cap], tx.pure(await signer.getAddress(), 'address'));
    tx.moveCall({
      target: `0x2::transfer::public_share_object`,
      typeArguments: [`0x2::kiosk::Kiosk`],
      arguments: [ kiosk ]
    });

    tx.moveCall({
      target: `0x2::transfer::public_share_object`,
      typeArguments: [`0x2::transfer_policy::TransferPolicy<${itemType}>`],
      arguments: [ policy ]
    });

    const result = await signer.signAndExecuteTransactionBlock(
      {
        transactionBlock: tx,
        options: {
          showEffects: true,
          showObjectChanges: true,
          showEvents: true,
        },
      },
      "WaitForLocalExecution"
    );

    // console.log(JSON.stringify(result, null, 4));
    let chg = result.objectChanges;

    let kiosk_obj = chg.find((r) => r.type === "created" && r.objectType === "0x2::kiosk::Kiosk");
    let policy_obj = chg.find((r) => r.type === "created" && r.objectType.includes("TransferPolicy<"));

    return [
      {
        objectId: kiosk_obj.objectId,
        initialSharedVersion: kiosk_obj.version,
        mutable: true
      },
      {
        objectId: policy_obj.objectId,
        initialSharedVersion: policy_obj.version,
        mutable: false,
      }
    ];
  })();

  console.log('purchase an item and deal with tranfer request');

  console.log(' - Item: %s', item);
  console.log(' - Item type: %s', itemType);
  console.log(' - Kiosk: %s', kiosk);
  console.log(' - TransferPolicy: %s', policy);

  await (async function () {
    const tx = new sdk.TransactionBlock();
    let payment = tx.splitCoins(tx.gas, [tx.pure(100000, 'u64')]);
    const [purchased_item, request] = tx.moveCall({
      target: `0x2::kiosk::purchase`,
      typeArguments: [itemType],
      arguments: [
        tx.object({ Object: { Shared: kiosk } }),
        tx.pure(item, 'address'),
        payment
      ]
    });

    tx.transferObjects([purchased_item], tx.pure(await signer.getAddress(), 'address'));
    tx.moveCall({
      target: `0x2::transfer_policy::confirm_request`,
      typeArguments: [itemType],
      arguments: [
        tx.object({ Object: { Shared: policy } }),
        request
      ]
    });

    const result = await signer.signAndExecuteTransactionBlock(
      {
        transactionBlock: tx,
        options: {
          showEffects: true,
          showObjectChanges: true,
          showEvents: true,
        },
      },
      "WaitForLocalExecution"
    );

    console.log(JSON.stringify(result, null, 4));
    console.log('ADDRESS IS: %s', await signer.getAddress());
  })();
})();
