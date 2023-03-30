# Install (testnet)

```
# skip the step if sui is installed
cargo install --locked --git https://github.com/MystenLabs/sui.git --branch testnet sui

# install sui.js
npm install

# export a variable or use it when running `publish.js`
export MNEMONIC="..."

# run the suite: publish, setup, purchase
node publish.js
```
