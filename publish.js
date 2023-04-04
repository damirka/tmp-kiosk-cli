// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0

const sdk = require("@mysten/sui.js");
const { TransactionBlock: TxBlock } = sdk;


if (!process.env.MNEMONIC) {
  console.log('Requires MNEMONIC; set with `export MNEMONIC="..."`');
  process.exit(1);
}

const connection = new sdk.Connection({ fullnode: "https://fullnode.testnet.sui.io/" });
const keypair = sdk.Ed25519Keypair.deriveKeypair(process.env.MNEMONIC);
const provider = new sdk.JsonRpcProvider(connection);
const signer = new sdk.RawSigner(keypair, provider);


const path = require("path");
const { execSync } = require("child_process");
const packagePath = path.resolve(__dirname, "packages", "artybara");
const compiled = JSON.parse(
  execSync(`sui move build --dump-bytecode-as-base64 --path ${packagePath}`, {
    encoding: "utf-8",
  })
);

(async () => {
  const sender = await signer.getAddress();
  const collectible = 'd35f7bf9525b4c4aa676d3c32ef53ec8ace095052e51e3db24462e0390d27383';
  const registry = 'be324773163a7b62f6e1546cabd229a4640da14a6ae4aa6d27e965b164ef6a37';

  console.log(' - Address is: %s', sender);
  console.log(' - Publishing the module and claiming the ticket');

  // publish the module;
  // get the ticket from the tx;
  let [pkg, ticket] = await (async function publish() {
    const tx = new TxBlock();
    const [upgradeCap] = tx.publish(
      compiled.modules.map((m) => [...sdk.fromB64(m)]),
      compiled.dependencies.map((addr) => sdk.normalizeSuiObjectId(addr))
    );
    tx.transferObjects([upgradeCap], tx.pure(sender));

    const { objectChanges: chg } = await signer.signAndExecuteTransactionBlock({
      transactionBlock: tx,
      options: { showObjectChanges: true },
    });

    return [
      chg.find((r) => r.type == "published").packageId,
      chg.find((r) => r.type == "created" && r.objectType.includes("collectible::CollectionTicket")),
    ];
  })();

  // Item type is static once the package is published;
  const itemType = `${pkg}::artybara::Artybara`;

  console.log(" - Item type: %s", itemType);
  console.log(" - ... ");

  const [policy, collection_cap] = await (async function () {
    const tx = new TxBlock();
    const [collection_cap] = tx.moveCall({
      target: `0x${collectible}::collectible::create_collection`,
      typeArguments: [itemType],
      arguments: [
        tx.object(registry),
        tx.object(ticket.objectId),
      ]
    });

    let [display, borrow_d] = tx.moveCall({
      target: `${collectible}::collectible::borrow_display`,
      typeArguments: [itemType],
      arguments: [collection_cap]
    })

    // tx.setGasBudget('10000000')

    let dType = `${collectible}::collectible::Collectible<${itemType}>`;
    let dConfig = {
      name: '{name}',
      image_url: '{image_url}',
      description: 'The rarest, the cutest, the most patient - meet the \'baras!',
      creator: 'Duh Mere',
      project_url: 'https://sui.io/',
    };

    tx.moveCall({
      target: `0x2::display::add_multiple`,
      typeArguments: [dType],
      arguments: [display, tx.pure(Object.keys(dConfig), 'vector<string>'), tx.pure(Object.values(dConfig), 'vector<string>')]
    });

    tx.moveCall({
      target: `0x2::display::update_version`,
      typeArguments: [dType],
      arguments: [display]
    });

    tx.moveCall({
      target: `${collectible}::collectible::return_display`,
      typeArguments: [itemType],
      arguments: [collection_cap, display, borrow_d]
    });

    tx.transferObjects([collection_cap], tx.pure(sender, 'address'));

    const res = await signer.signAndExecuteTransactionBlock({
      transactionBlock: tx,
      options: { showObjectChanges: true, showEffects: true }
    });

    console.log(JSON.stringify(res, null, 4));

    const { objectChanges: chg } = res;


    let policy = chg.find((e) => e.type == "created" && e.objectType.includes("TransferPolicy"));
    let owner_cap = chg.find((e) => e.type == "created" && e.objectType.includes("CollectionCap"));

    return [
      policy,
      owner_cap
    ];
  })();

  console.log(' - minting collection');

  const [] = await (async () => {

    const tx = new TxBlock();

    const [ none ] = tx.moveCall({
      target: `0x1::option::none`,
      typeArguments: [`vector<${itemType}>`],
    });

    const [ ] = tx.moveCall({
      target: `${collectible}::collectible::batch_mint`,
      typeArguments: [itemType],
      arguments: [
        tx.object({
          Object: {
            ImmOrOwned: {
              objectId: collection_cap.objectId,
              version: collection_cap.version,
              digest: collection_cap.digest
            }
          }
        }),

        // image_urls
        tx.pure([
          'https://www.rainforest-alliance.org/wp-content/uploads/2021/06/capybara-square-1.jpg.optimal.jpg',
          'https://cdn.britannica.com/77/191677-050-3CBF2834/Capybara.jpg',
          'https://www.hellabrunn.de/fileadmin/_processed_/d/8/csm_wasserschwein-tierpark-hellabrunn-amerika-tierlexikon_f6feb22d52.jpg',
          'https://i2-prod.devonlive.com/incoming/article6439269.ece/ALTERNATES/s1200c/0_BD_DL_https-exmoorzooarrivals-_4-1-2_04.jpg',
          'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQKEBgEgGp_d60uG56v6lheJCZLPLMJg4bLDw&usqp=CAU',
        ], 'vector<string>'),

        // names
        tx.pure({
          Some: [
            'Clunky',
            'Blonk',
            'Grog',
            'Cheeba',
            'Thook'
          ]
        }, 'Option<vector<string>>'),

        // descriptions
        tx.pure({ None: true }, 'Option<vector<string>'),

        // creators
        tx.pure({ None: true }, 'Option<vector<string>'),

        // metas
        none
      ]
    });

    // tx.transferObjects(capys, tx.pure(sender, 'address'));

    await signer.signAndExecuteTransactionBlock({
      transactionBlock: tx
    });

    return [];
  })();

  // console.log(' - done, bruh');

  // // const [kiosk, policy] = await (async function kiosk() {
  // //   const tx = new sdk.TransactionBlock();
  // //   const [kiosk, kiosk_cap] = tx.moveCall({ target: `0x2::kiosk::new` });
  // //   tx.moveCall({
  // //     target: `0x2::kiosk::place_and_list`,
  // //     typeArguments: [itemType],
  // //     arguments: [kiosk, kiosk_cap, tx.object(item), tx.pure(100000, "u64")],
  // //   });

  // //   let [policy, policy_cap] = tx.moveCall({
  // //     target: `0x2::transfer_policy::new`,
  // //     typeArguments: [itemType],
  // //     arguments: [tx.object(publisher)],
  // //   });

  // //   tx.moveCall({
  // //     target: `${pkg}::policy::set`,
  // //     typeArguments: [itemType],
  // //     arguments: [policy, policy_cap]
  // //   });

  // //   tx.transferObjects(
  // //     [policy_cap, kiosk_cap],
  // //     tx.pure(sender, "address")
  // //   );

  // //   tx.moveCall({
  // //     target: `0x2::transfer::public_share_object`,
  // //     typeArguments: [`0x2::kiosk::Kiosk`],
  // //     arguments: [kiosk],
  // //   });

  // //   tx.moveCall({
  // //     target: `0x2::transfer::public_share_object`,
  // //     typeArguments: [`0x2::transfer_policy::TransferPolicy<${itemType}>`],
  // //     arguments: [policy],
  // //   });

  // //   const result = await signer.signAndExecuteTransactionBlock({
  // //     transactionBlock: tx,
  // //     options: {
  // //       showEffects: true,
  // //       showObjectChanges: true,
  // //       showEvents: true,
  // //     },
  // //   });

  // //   let chg = result.objectChanges;
  // //   let kiosk_obj = chg.find(
  // //     (r) => r.type === "created" && r.objectType === "0x2::kiosk::Kiosk"
  // //   );
  // //   let policy_obj = chg.find(
  // //     (r) => r.type === "created" && r.objectType.includes("TransferPolicy<")
  // //   );

  // //   return [
  // //     {
  // //       objectId: kiosk_obj.objectId,
  // //       initialSharedVersion: kiosk_obj.version,
  // //       mutable: true,
  // //     },
  // //     {
  // //       objectId: policy_obj.objectId,
  // //       initialSharedVersion: policy_obj.version,
  // //       mutable: true,
  // //     },
  // //   ];
  // // })();

  // // console.log("purchase an item and deal with tranfer request");

  // // console.log(" - Item: %s", item);
  // // console.log(" - Item type: %s", itemType);
  // // console.log(" - Kiosk: %s", kiosk);
  // // console.log(" - TransferPolicy: %s", policy);

  // // await (async function () {
  // //   const tx = new sdk.TransactionBlock();
  // //   let [payment, commission] = tx.splitCoins(tx.gas, [
  // //     tx.pure(100000, "u64"),
  // //     tx.pure(1000, "u64")
  // //   ]);
  // //   const [purchased_item, request] = tx.moveCall({
  // //     target: `0x2::kiosk::purchase`,
  // //     typeArguments: [itemType],
  // //     arguments: [
  // //       tx.object({ Object: { Shared: kiosk } }),
  // //       tx.pure(item, "address"),
  // //       payment,
  // //     ],
  // //   });

  // //   tx.transferObjects(
  // //     [purchased_item],
  // //     tx.pure(sender, "address")
  // //   );

  // //   tx.moveCall({
  // //     target: `${pkg}::policy::pay`,
  // //     typeArguments: [itemType],
  // //     arguments: [
  // //       tx.object({ Object: { Shared: policy } }),
  // //       request,
  // //       commission
  // //     ]
  // //   });

  // //   tx.moveCall({
  // //     target: `0x2::transfer_policy::confirm_request`,
  // //     typeArguments: [itemType],
  // //     arguments: [tx.object({ Object: { Shared: policy } }), request],
  // //   });

  // //   const result = await signer.signAndExecuteTransactionBlock({
  // //     transactionBlock: tx,
  // //     options: {
  // //       showEffects: true,
  // //       showObjectChanges: true,
  // //       showEvents: true,
  // //     },
  // //   });

  // //   console.log(JSON.stringify(result, null, 4));
  // // })();

  // // await (async function () {
  // //   const tx = new sdk.TransactionBlock();
  // //   const [ advancedItem ] = tx.moveCall({
  // //     target: `${pkg}::registry::upgrade`,
  // //     typeArguments: [],
  // //     arguments: [ tx.object(item) ],
  // //   });

  // //   tx.transferObjects(
  // //     [advancedItem],
  // //     tx.pure(sender, "address")
  // //   );

  // //   const result = await signer.signAndExecuteTransactionBlock({
  // //     transactionBlock: tx,
  // //     options: {
  // //       showEffects: true,
  // //       showObjectChanges: true,
  // //       showEvents: true,
  // //     },
  // //   });

  // //   console.log(JSON.stringify(result, null, 4));
  // // })();
})();


// const path = require("path");
// const { execSync } = require("child_process");
// const packagePath = path.resolve(__dirname);
// const compiled = JSON.parse(
//   execSync(`sui move build --dump-bytecode-as-base64 --path ${packagePath}`, {
//     encoding: "utf-8",
//   })
// );

function findOrFail(objectChanges, type) {
  console.log(objectChanges);
  let obj = objectChanges.find((r) => ["created", "mutated"].includes(r.type) && r.objectType.includes(type));
  if (obj) return obj
  else throw new Error('failed to find object of type ' + type);
}
