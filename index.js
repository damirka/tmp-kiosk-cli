/**
 * This script uses the `test.move` module to mint an NFT (TransferPolicy is
 * already created and published).
 *
 * Scenarios covered:
 * ```
 * # supported scenarios (one at the time):
 *
 * --new # create and share a Kiosk to sender
 * --purchase-from-kiosk <ID> <ITEM_ID> # purchase an item from the specified Kiosk
 * --mint-to-kiosk <ID> <ITEM_ID> # mint an item and place it to the specified Kiosk
 * ```
 */

const {
  RawSigner,
  testnetConnection,
  Ed25519Keypair,
  TransactionBlock,
  JsonRpcProvider,
  formatAddress
} = require('@mysten/sui.js');
const { program } = require('commander');
const { createKioskAndShare, KIOSK_TYPE, purchaseAndResolvePolicies, fetchKiosk, place, list, purchase, queryTransferPolicy, delist, withdrawFromKiosk } = require('@mysten/kiosk');

/** The published package ID. {@link https://suiexplorer.com/object/0x52852c4ba80040395b259c641e70b702426a58990ff73cecf5afd31954429090?network=testnet} */
const PKG = '0x52852c4ba80040395b259c641e70b702426a58990ff73cecf5afd31954429090';
/** The fully qualified type of the `TestItem` to use in struct tags */
const ITEM_TYPE = `${PKG}::test::TestItem`;
/** The `mint` function in the `test` package */
const MINT_FUNC = `${PKG}::test::mint`;

/** JsonRpcProvider for the Testnet */
const provider = new JsonRpcProvider(testnetConnection);

/**
 * Create the signer instance from the mnemonic.
 */
const signer = (function (mnemonic) {
  if (!mnemonic) {
    console.log('Requires MNEMONIC; set with `export MNEMONIC="..."`');
    process.exit(1);
  }

  const keypair = Ed25519Keypair.deriveKeypair(process.env.MNEMONIC);
  const provider = new JsonRpcProvider(testnetConnection);
  return new RawSigner(keypair, provider);
})(process.env.MNEMONIC);

program
  .name('kiosk-cli')
  .description('Simple CLI to interact with Kiosk smart contracts')
  .version('0.0.1');

program
  .command('new')
  .description('create and share a Kiosk; send OwnerCap to sender')
  .action(newKiosk);

program
  .command('contents')
  .description('list all Items and Listings in the Kiosk owned by the sender')
  .option('-i, --id <id>', 'The ID of the Kiosk to look up')
  .option('-a, --address <address>', 'The address of the Kiosk owner')
  .action(showContents);

program
  .command('list')
  .description('list an item in the Kiosk for the specified amount of SUI')
  .argument('<item ID>', 'The ID of the item to list')
  .argument('<amount MIST>', 'The amount of SUI to list the item for')
  .action(listItem);

program
  .command('delist')
  .description('delist an item from the Kiosk')
  .argument('<item ID>', 'The ID of the item to delist')
  .action(delistItem);

program
  .command('mint-to-kiosk')
  .description('mint a test item into the user Kiosk')
  .action(mintToKiosk);

program
  .command('purchase')
  .description('purchase an item from the specified Kiosk')
  .argument('<kiosk ID>', 'The ID of the Kiosk to purchase from')
  .argument('<item ID>', 'The ID of the item to purchase')
  .action(purchaseItem);

program
  .command('search')
  .description('search open listings in Kiosks')
  .argument('<type>', 'The type of the item to search for')
  .action(searchType);

program
  .command('withdraw')
  .description('Withdraw all profits from the Kiosk')
  .action(withdrawAll);

program.parse(process.argv);

/**
 * Command: `new`
 * Description: creates and shares a Kiosk
 */
async function newKiosk() {
  const sender = await signer.getAddress();
  const kioskCap = await findKioskCap().catch(() => null);

  if (kioskCap !== null) {
    throw new Error(`Kiosk already exists for ${sender}`);
  }

  const txb = new TransactionBlock();
  const cap = createKioskAndShare(txb);
  txb.transferObjects([cap], txb.pure(sender));

  return sendTx(txb);
}

/**
 * Command: `contents`
 * Description: Show the contents of the Kiosk owned by the sender (or the
 * specified address) or directly by the specified Kiosk ID
 */
async function showContents({ id, address }) {
  let kioskId = null;

  if (!!id) {
    kioskId = id;
  } else {
    const sender = address || await signer.getAddress();
    const kioskCap = await findKioskCap(sender).catch(() => null);
    if (kioskCap == null) {
      throw new Error(`No Kiosk found for ${sender}`);
    }
    kioskId = kioskCap.content.fields.for;
  }

  const { data: { items, listings, kiosk } } = await fetchKiosk(provider, kioskId, { limit: 1000 }, {
    includeKioskFields: true,
    withListingPrices: true,
    includeItems: true,
  });

  console.log('Description');
  console.log('- Kiosk ID:    %s', kioskId);
  console.log('- Sender is:   %s', kioskId);
  console.log('- Profits:     %s', kiosk.profits);
  console.log('- UID Exposed: %s', kiosk.allowExtensions);
  console.log('- Item Count:  %s', kiosk.itemCount);
  console.table(items.map((item) => ({
    objectId: item.data.objectId,
    type: formatType(item.data.type),
    listed: listings.some((l) => l.itemId == item.data.objectId),
    price: listings.find((l) => l.itemId == item.data.objectId)?.price || 'N/A'
  })).sort((a, b) => a.listed - b.listed));
}

/**
 * Command: `mint-to-kiosk`
 * Description: Mints a test item into the user Kiosk (if Kiosk exists,
 * aborts otherwise)
 */
async function mintToKiosk() {
  const kioskCap = await findKioskCap().catch(() => null);
  if (kioskCap === null) {
    throw new Error('No Kiosk found for sender');
  }
  const kioskId = kioskCap.content.fields.for;

  const txb = new TransactionBlock();
  const kioskArg = txb.object(kioskId);
  const capArg = txb.objectRef({ ...kioskCap });
  const nft = txb.moveCall({ target: MINT_FUNC });

  place(txb, ITEM_TYPE, kioskArg, capArg, nft);

  return sendTx(txb);
}

/**
 * Command: `list`
 * Description: Lists an item in the Kiosk for the specified amount of SUI
 */
async function listItem(itemId, amount) {
  const kioskCap = await findKioskCap().catch(() => null);
  if (kioskCap === null) {
    throw new Error('No Kiosk found for sender');
  }
  const kioskId = kioskCap.content.fields.for;

  const txb = new TransactionBlock();
  const kioskArg = txb.object(kioskId);
  const capArg = txb.objectRef({ ...kioskCap });
  list(txb, ITEM_TYPE, kioskArg, capArg, itemId, amount);
  return sendTx(txb);
}

/**
 * Command: `delist`
 * Description: Delists an active listing in the Kiosk
 */
async function delistItem(itemId) {
  const kioskCap = await findKioskCap().catch(() => null);
  if (kioskCap === null) {
    throw new Error('No Kiosk found for sender');
  }

  const kioskId = kioskCap.content.fields.for;
  const txb = new TransactionBlock();
  const kioskArg = txb.object(kioskId);
  const capArg = txb.objectRef({ ...kioskCap });
  delist(txb, ITEM_TYPE, kioskArg, capArg, itemId);
  return sendTx(txb);
}

/**
 * Command: `purchase`
 * Description: Purchases an item from the specified Kiosk
 */
async function purchaseItem(kioskId, itemId) {
  const itemInfo = await provider.getObject({ id: itemId, options: { showType: true }});
  const [kiosk, policies, listing] = await Promise.all([
    provider.getObject({ id: kioskId, options: { showOwner: true }}),
    queryTransferPolicy(provider, itemInfo.data.type),
    provider.getDynamicFieldObject({
      parentId: kioskId,
      name: { type: '0x2::kiosk::Listing', value: { id: itemId, is_exclusive: false }}
    })
  ]);

  if ('error' in listing || !listing.data) {
    throw new Error(`Item ${itemId} not listed in Kiosk ${kioskId}`);
  }

  if ('error' in kiosk || !kiosk.data) {
    throw new Error(`Kiosk ${kioskId} not found`);
  }

  if ('error' in itemInfo || !itemInfo.data) {
    throw new Error(`Item ${itemId} not found`);
  }

  if (policies.length === 0) {
    throw new Error(`No transfer policy found for type ${itemInfo.data.type}`);
  }

  const price = listing.data.content.fields.value;
  const txb = new TransactionBlock();
  const kioskArg = txb.sharedObjectRef({
    mutable: true,
    objectId: kioskId,
    initialSharedVersion: kiosk.data.owner.Shared.initial_shared_version
  });

  const policyArg = txb.object(policies[0].id);
  const payment = txb.splitCoins(txb.gas, [ txb.pure(price, 'u64') ]);
  const idArg = txb.pure(itemId, 'address');
  const [item, req] = txb.moveCall({
    target: `0x2::kiosk::purchase`,
    typeArguments: [itemInfo.data.type],
    arguments: [kioskArg, idArg, payment]
  });

  txb.moveCall({
    target: `0x2::transfer_policy::confirm_request`,
    typeArguments: [itemInfo.data.type],
    arguments: [policyArg, req]
  });
  txb.transferObjects([item], txb.pure(await signer.getAddress(), 'address'));

  return sendTx(txb);
}

/**
 * Command: `search`
 * Description: Searches for items of the specified type
 */
async function searchType(type) {
  const [{ data: listed }, { data: delisted }, { data: purchased }] = await Promise.all([
    provider.queryEvents({
      query: { MoveEventType: `0x2::kiosk::ItemListed<${type}>` },
      limit: 1000,
    }),
    provider.queryEvents({
      query: { MoveEventType: `0x2::kiosk::ItemDelisted<${type}>` },
      limit: 1000,
    }),
    provider.queryEvents({
      query: { MoveEventType: `0x2::kiosk::ItemPurchased<${type}>` },
      limit: 1000,
    })
  ]);

  const listings = listed
    .filter((e) => {
      const { id: itemId, kiosk } = e.parsedJson;
      const timestamp = e.timestampMs;
      return !delisted.some((item) => (itemId == item.parsedJson.id && timestamp < item.timestampMs));
    })
    .filter((e) => {
      const { id: itemId, kiosk } = e.parsedJson;
      const timestamp = e.timestampMs;
      return !purchased.some((item) => (itemId == item.parsedJson.id && timestamp < item.timestampMs));
    })

  console.table(listings.map((e) => ({
    objectId: e.parsedJson.id,
    kiosk: e.parsedJson.kiosk,
    price: e.parsedJson.price,
    // type: formatType(e.type),
  })));
}

/**
 * Command: `withdraw`
 * Description: Withdraws funds from the Kiosk and send them to sender.
 */
async function withdrawAll() {
  const sender = await signer.getAddress();
  const kioskCap = await findKioskCap(sender).catch(() => null);
  if (kioskCap === null) {
    throw new Error('No Kiosk found for sender');
  }

  const kioskId = kioskCap.content.fields.for;
  const txb = new TransactionBlock();
  const kioskArg = txb.object(kioskId);
  const capArg = txb.objectRef({ ...kioskCap });
  const coin = withdrawFromKiosk(txb, kioskArg, capArg, null);

  txb.transferObjects([coin], txb.pure(sender, 'address'));
  return sendTx(txb);
}

/**
 * Find the KioskOwnerCap at the sender address.
 */
async function findKioskCap(address) {
  const sender = address || (await signer.getAddress());
  const objects = await provider.getOwnedObjects({
    owner: sender,
    filter: { StructType: '0x2::kiosk::KioskOwnerCap' },
    options: { showContent: true },
  });

  let [kioskCap] = objects.data;
  if (!kioskCap) {
    throw new Error(`No Kiosk found for ${sender}`);
  }

  if ('error' in kioskCap || !('data' in kioskCap)) {
    throw new Error(`Error fetching Kiosk: ${kioskCap.error}`);
  }

  return kioskCap.data;
}

/**
 * Send the transaction and print the `object changes: created` result.
 * If there are errors, print them.
 */
async function sendTx(txb) {
  return signer.signAndExecuteTransactionBlock({
    transactionBlock: txb,
    options: {
      showObjectChanges: true,
    },
  }).then((result) => {
    if ('errors' in result) {
      console.error('Errors found: %s', result.errors);
    } else {
      console.table(
        result.objectChanges.map((change) => ({
          objectId: change.objectId,
          type: change.type,
          sender: formatAddress(change.sender),
          objectType: formatType(change.objectType),
        }))
      )
    }
  });
}

function formatType(type) {
  let parts = type.split('::');
  return [
    formatAddress(parts[0]),
    parts[1],
    parts[2],
  ].join('::');
}

process.on('uncaughtException', (err) => {
  console.error(err.message);
  process.exit(1);
});
