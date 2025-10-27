All set! I dropped the helper script as a standalone file:

* [Download **teleburn-solana.js**](sandbox:/mnt/data/teleburn-solana.js)
* (From earlier) [Download **teleburn-solana.md**](sandbox:/mnt/data/teleburn-solana.md)

Quick run reminder:

```bash
npm i @solana/web3.js @solana/spl-token
node teleburn-solana.js --rpc https://api.mainnet-beta.solana.com \
  --keypair ~/.config/solana/id.json \
  --mint <SOLANA_MINT_ADDRESS> \
  --inscription <BITCOIN_INSCRIPTION_ID> \
  --media ./original-artwork.png \
  --method burn
```

Want me to wrap this as an npm CLI (with prompts + safety checks) or add a cNFT/Bubblegum burn path next?
