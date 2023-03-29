const sdk = require('@mysten/sui.js');
const { execSync } = require('child_process');
const path = require('path');
const packagePath = path.resolve(__dirname, '../');

// Generate a new Keypair
const keypair = new sdk.Ed25519Keypair();
const provider = new sdk.JsonRpcProvider();
const signer = new sdk.RawSigner(keypair, provider);

const compiledModulesAndDeps = JSON.parse(
  execSync(
    `sui move build --dump-bytecode-as-base64 --path ${packagePath}`,
    { encoding: 'utf-8' },
  ),
);

(async () => {
    // request coins from faucet
    const provider = new sdk.JsonRpcProvider(sdk.devnetConnection);
    await provider.requestSuiFromFaucet( await signer.getAddress() );

    // wait for some time - fn needs to fetch coin changes
    await require('util').promisify(setTimeout)(5000);

    const tx = new sdk.TransactionBlock();
    const [upgradeCap] = tx.publish(
        compiledModulesAndDeps.modules.map((m) => Array.from(sdk.fromB64(m))),
        compiledModulesAndDeps.dependencies.map((addr) => sdk.normalizeSuiObjectId(addr))
    );

    tx.transferObjects([upgradeCap], tx.pure(await signer.getAddress()));

    const result = await signer.signAndExecuteTransactionBlock({ transactionBlock: tx }, {
        showEffects: true,
        showEvents: true
    }, 'WaitForEffectsCert');

    console.log({ result });
})();
