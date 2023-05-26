/**
 * This script uses the `test.move` module to mint an NFT (TransferPolicy is
 * already created and published).
 *
 * TODO:
 *
 * - transfer from Kiosk
 * - locking in the Kiosk
 * - purchase to sender (if not locked)
 * - place into Kiosk (from inventory)
 * - take to sender
 *
 * Gas logging for every operation!
 */

const {
  RawSigner,
  testnetConnection,
  Ed25519Keypair,
  TransactionBlock,
  JsonRpcProvider,
  formatAddress,
  isValidSuiAddress,
  isValidSuiObjectId,
} = require('@mysten/sui.js');
const { program } = require('commander');
const {
  createKioskAndShare,
  fetchKiosk,
  place,
  list,
  queryTransferPolicy,
  delist,
  withdrawFromKiosk,
  take,
} = require('@mysten/kiosk');

/** The published package ID. {@link https://suiexplorer.com/object/0x52852c4ba80040395b259c641e70b702426a58990ff73cecf5afd31954429090?network=testnet} */
const PKG = '0x52852c4ba80040395b259c641e70b702426a58990ff73cecf5afd31954429090';
/** The fully qualified type of the `TestItem` to use in struct tags */
const ITEM_TYPE = `${PKG}::test::TestItem`;
/** The `mint` function in the `test` package */
const MINT_FUNC = `${PKG}::test::mint`;

/**
 * List of known types for shorthand search in the `search` command.
 */
const KNOWN_TYPES = {
  suifrens: '0x80d7de9c4a56194087e0ba0bf59492aa8e6a5ee881606226930827085ddf2332::suifrens::SuiFren<0x80d7de9c4a56194087e0ba0bf59492aa8e6a5ee881606226930827085ddf2332::capy::Capy>',
  test: ITEM_TYPE
};


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
  .description('Simple CLI to interact with Kiosk smart contracts. \nRequires MNEMONIC environment variable.')
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
  .command('take')
  .description('Take an item from the Kiosk and transfer to sender or to <address>')
  .argument('<item ID>', 'The ID of the item to take')
  .option('-a, --address <address>')
  .action(takeItem);

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
  .option('-t, --target ["kiosk" | <address>]', 'Purchase destination: "kiosk" for user Kiosk or \ncustom address (defaults to sender)')
  .action(purchaseItem);

program
  .command('search')
  .description('search open listings in Kiosks')
  .argument('<type>', 'The type of the item to search for. \nAvailable aliases: "suifrens", "test"')
  .action(searchType);

program
  .command('withdraw')
  .description('Withdraw all profits from the Kiosk to the Kiosk Owner')
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

  if (id) {
    if (!isValidSuiObjectId(id)) {
      throw new Error(`Invalid Kiosk ID: "${id}"`);
    }

    kioskId = id;
  } else {
    const sender = address || (await signer.getAddress());
    const kioskCap = await findKioskCap(sender).catch(() => null);
    if (kioskCap == null) {
      throw new Error(`No Kiosk found for ${sender}`);
    }
    kioskId = kioskCap.content.fields.for;
  }

  const {
    data: { items, listings, kiosk },
  } = await fetchKiosk(
    provider,
    kioskId,
    { limit: 1000 },
    {
      includeKioskFields: true,
      withListingPrices: true,
      includeItems: true,
    },
  );

  console.log('Description');
  console.log('- Kiosk ID:    %s', kioskId);
  console.log('- Profits:     %s', kiosk.profits);
  console.log('- UID Exposed: %s', kiosk.allowExtensions);
  console.log('- Item Count:  %s', kiosk.itemCount);
  console.table(
    items
      .map((item) => ({
        objectId: item.data.objectId,
        type: formatType(item.data.type),
        listed: listings.some((l) => l.itemId == item.data.objectId),
        price: listings.find((l) => l.itemId == item.data.objectId)?.price || 'N/A',
      }))
      .sort((a, b) => a.listed - b.listed),
  );
}

/**
 * Command: `take`
 * Description: Take an item from the Kiosk and transfer to sender (or to
 * --address <address>)
 */
async function takeItem(itemId, { address }) {
  const kioskCap = await findKioskCap().catch(() => null);
  const receiver = address || (await signer.getAddress());

  if (!isValidSuiAddress(receiver)) {
    throw new Error('Invalid receiver address: "%s"', receiver);
  }

  if (!isValidSuiObjectId(itemId)) {
    throw new Error('Invalid Item ID: "%s"', itemId);
  }

  if (kioskCap === null) {
    throw new Error('No Kiosk found for sender; use `new` to create one');
  }

  const item = await provider.getObject({ id: itemId, options: { showType: true }});

  if ('error' in item || !item.data) {
    throw new Error(`Item ${itemId} not found; error: ` + item.error);
  }

  const txb = new TransactionBlock();
  const kioskArg = txb.object(kioskCap.content.fields.for);
  const capArg = txb.objectRef({ ...kioskCap });
  const taken = take(txb, item.data.type, kioskArg, capArg, itemId);

  txb.transferObjects([taken], txb.pure(receiver, 'address'));

  return sendTx(txb);
}

/**
 * Command: `mint-to-kiosk`
 * Description: Mints a test item into the user Kiosk (if Kiosk exists,
 * aborts otherwise)
 */
async function mintToKiosk() {
  const kioskCap = await findKioskCap().catch(() => null);

  if (kioskCap === null) {
    throw new Error('No Kiosk found for sender; use `new` to create one');
  }

  const txb = new TransactionBlock();
  const kioskArg = txb.object(kioskCap.content.fields.for);
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
    throw new Error('No Kiosk found for sender; use `new` to create one');
  }

  if (!isValidSuiObjectId(itemId)) {
    throw new Error('Invalid Item ID: "%s"', itemId);
  }

  const item = await provider.getObject({ id: itemId, options: { showType: true }});

  if ('error' in item || !item.data) {
    throw new Error(`Item ${itemId} not found; error: ` + item.error);
  }

  const txb = new TransactionBlock();
  const kioskArg = txb.object(kioskCap.content.fields.for);
  const capArg = txb.objectRef({ ...kioskCap });
  list(txb, item.data.type, kioskArg, capArg, itemId, amount);

  return sendTx(txb);
}

/**
 * Command: `delist`
 * Description: Delists an active listing in the Kiosk
 */
async function delistItem(itemId) {
  const kioskCap = await findKioskCap().catch(() => null);

  if (kioskCap === null) {
    throw new Error('No Kiosk found for sender; use `new` to create one');
  }

  if (!isValidSuiObjectId(itemId)) {
    throw new Error('Invalid Item ID: "%s"', itemId);
  }

  const item = await provider.getObject({ id: itemId, options: { showType: true }});

  if ('error' in item || !item.data) {
    throw new Error(`Item ${itemId} not found; error: ` + item.error);
  }

  const txb = new TransactionBlock();
  const kioskArg = txb.object(kioskCap.content.fields.for);
  const capArg = txb.objectRef({ ...kioskCap });
  delist(txb, item.data.type, kioskArg, capArg, itemId);

  return sendTx(txb);
}

/**
 * Command: `purchase`
 * Description: Purchases an item from the specified Kiosk
 *
 * TODO:
 * - add destination "kiosk" or "user" (kiosk by default)
 */
async function purchaseItem(kioskId, itemId, opts) {
  const { target } = opts;

  if (target && target !== 'kiosk' && !isValidSuiAddress(target)) {
    throw new Error('Invalid target address: "%s"; use "kiosk" if you want to store in your Kiosk', target);
  }

  if (!isValidSuiObjectId(itemId)) {
    throw new Error('Invalid Item ID: "%s"', itemId);
  }

  if (!isValidSuiObjectId(kioskId)) {
    throw new Error('Invalid Kiosk ID: "%s"', kioskId);
  }

  const itemInfo = await provider.getObject({ id: itemId, options: { showType: true } });
  const [kiosk, policies, listing] = await Promise.all([
    provider.getObject({ id: kioskId, options: { showOwner: true } }),
    queryTransferPolicy(provider, itemInfo.data.type),
    provider.getDynamicFieldObject({
      parentId: kioskId,
      name: { type: '0x2::kiosk::Listing', value: { id: itemId, is_exclusive: false } },
    }),
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
    initialSharedVersion: kiosk.data.owner.Shared.initial_shared_version,
  });

  const policyArg = txb.object(policies[0].id);
  const payment = txb.splitCoins(txb.gas, [txb.pure(price, 'u64')]);
  const idArg = txb.pure(itemId, 'address');
  const [item, req] = txb.moveCall({
    target: `0x2::kiosk::purchase`,
    typeArguments: [itemInfo.data.type],
    arguments: [kioskArg, idArg, payment],
  });

  txb.moveCall({
    target: `0x2::transfer_policy::confirm_request`,
    typeArguments: [itemInfo.data.type],
    arguments: [policyArg, req],
  });

  if (target === 'kiosk') {
    const kioskCap = await findKioskCap().catch(() => null);
    if (kioskCap === null) {
      throw new Error('No Kiosk found for sender; use `new` to create one; cannot place item to Kiosk');
    }

    const kioskArg = txb.object(kioskCap.content.fields.for);
    const capArg = txb.objectRef({ ...kioskCap });

    place(txb, itemInfo.data.type, kioskArg, capArg, item);
  } else {
    const receiver = target || (await signer.getAddress());
    txb.transferObjects([item], txb.pure(receiver, 'address'));
  }

  return sendTx(txb);
}

/**
 * Command: `search`
 * Description: Searches for items of the specified type
 */
async function searchType(type) {
  // use known types if available;
  type = KNOWN_TYPES[type] || type;

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
    }),
  ]);

  const listings = listed
    .filter((e) => {
      const { id: itemId } = e.parsedJson;
      const timestamp = e.timestampMs;
      return !delisted.some((item) => itemId == item.parsedJson.id && timestamp < item.timestampMs);
    })
    .filter((e) => {
      const { id: itemId } = e.parsedJson;
      const timestamp = e.timestampMs;
      return !purchased.some(
        (item) => itemId == item.parsedJson.id && timestamp < item.timestampMs,
      );
    });

  console.log('- Type:', type);
  console.table(
    listings.map((e) => ({
      objectId: e.parsedJson.id,
      kiosk: e.parsedJson.kiosk,
      price: e.parsedJson.price,
    })),
  );
}

/**
 * Command: `withdraw`
 * Description: Withdraws funds from the Kiosk and send them to sender.
 */
async function withdrawAll() {
  const sender = await signer.getAddress();
  const kioskCap = await findKioskCap(sender).catch(() => null);
  if (kioskCap === null) {
    throw new Error('No Kiosk found for sender; use `new` to create one');
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

  if (!isValidSuiAddress(sender)) {
    throw new Error(`Invalid address "${sender}"`);
  }

  const objects = await provider.getOwnedObjects({
    owner: sender,
    filter: { StructType: '0x2::kiosk::KioskOwnerCap' },
    options: { showContent: true },
  });

  let [kioskCap] = objects.data;
  if (!kioskCap) {
    throw new Error(`No Kiosk found for "${sender}"`);
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
  return signer
    .signAndExecuteTransactionBlock({
      transactionBlock: txb,
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
    })
    .then((result) => {
      if ('errors' in result) {
        console.error('Errors found: %s', result.errors);
      } else {
        console.table(
          result.objectChanges.map((change) => ({
            objectId: change.objectId,
            type: change.type,
            sender: formatAddress(change.sender),
            objectType: formatType(change.objectType),
          })),
        );
      }
      let gas = result.effects.gasUsed;
      let total = BigInt(gas.computationCost) + BigInt(gas.storageCost) - BigInt(gas.storageRebate);

      console.log('Computation cost:          %s', gas.computationCost);
      console.log('Storage cost:              %s', gas.storageCost);
      console.log('Storage rebate:            %s', gas.storageRebate);
      console.log('NonRefundable Storage Fee: %s', gas.nonRefundableStorageFee);
      console.log('Total Gas:                 %s', total.toString());
    });
}

/**
 * Shortens the type (currently, a little messy).
 */
function formatType(type) {
  let [pre, post] = type.split('<');
  let parts = pre.split('::');
  return !!post
    ? [formatAddress(parts[0]), parts[1], parts[2]].join('::') + '<' + formatType(post)
    : [formatAddress(parts[0]), parts[1]].join('::');
}

process.on('uncaughtException', (err) => {
  console.error(err.message);
  process.exit(1);
});
