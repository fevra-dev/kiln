#!/usr/bin/env node
/**
 * Teleburn helper for Solana NFTs:
 *  - Computes SHA-256 of media
 *  - Posts an SPL Memo anchoring {inscription_id, mint, sha256}
 *  - Burns the NFT (default), or transfers to incinerator (optional)
 *
 * USAGE:
 *  node teleburn-solana.js \
 *    --rpc https://api.mainnet-beta.solana.com \
 *    --keypair ~/.config/solana/id.json \
 *    --mint <SOLANA_MINT_ADDRESS> \
 *    --inscription <BITCOIN_INSCRIPTION_ID> \
 *    --media ./path/to/file.ext \
 *    [--method burn|incinerate]   # default: burn
 *    [--force]                    # skip uniqueness checks
 */

const fs = require("fs");
const { createHash } = require("crypto");
const {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} = require("@solana/web3.js");
const {
  getAssociatedTokenAddress,
  getAccount,
  getMint,
  createBurnInstruction,
  createCloseAccountInstruction,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} = require("@solana/spl-token");

// SPL Memo program
const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);
// Canonical Solana incinerator address (no known private key)
const INCINERATOR = new PublicKey(
  "1nc1nerator11111111111111111111111111111111"
);

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    if (k.startsWith("--")) {
      if (v && !v.startsWith("--")) {
        args[k.slice(2)] = v;
        i++;
      } else {
        args[k.slice(2)] = true;
      }
    }
  }
  if (!args.rpc || !args.keypair || !args.mint || !args.inscription || !args.media) {
    console.error(
      "Missing required args. See header comment for usage."
    );
    process.exit(1);
  }
  args.method = args.method || "burn";
  if (!["burn", "incinerate"].includes(args.method)) {
    console.error("--method must be 'burn' or 'incinerate'");
    process.exit(1);
  }
  return args;
}

function loadKeypair(path) {
  const raw = JSON.parse(fs.readFileSync(path, "utf8"));
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

function sha256File(path) {
  const buf = fs.readFileSync(path);
  const h = createHash("sha256").update(buf).digest("hex");
  return h;
}

async function main() {
  const args = parseArgs(process.argv);
  const payer = loadKeypair(args.keypair);
  const connection = new Connection(args.rpc, "confirmed");

  const mintPk = new PublicKey(args.mint);
  const inscriptionId = String(args.inscription).trim();
  const sha256 = sha256File(args.media);

  // Detect which token program owns the mint (Token vs Token-2022)
  const mintInfoAcc = await connection.getAccountInfo(mintPk);
  if (!mintInfoAcc) {
    throw new Error("Mint account not found on chain.");
  }
  const tokenProgramId = mintInfoAcc.owner.equals(TOKEN_2022_PROGRAM_ID)
    ? TOKEN_2022_PROGRAM_ID
    : TOKEN_PROGRAM_ID;

  // Fetch mint/account details
  const mintInfo = await getMint(connection, mintPk, "confirmed", tokenProgramId);
  if (mintInfo.decimals !== 0) {
    console.warn(
      `Warning: mint has decimals=${mintInfo.decimals}. This is atypical for NFTs.`
    );
  }

  // Holder's ATA
  const holderAta = await getAssociatedTokenAddress(
    mintPk,
    payer.publicKey,
    false,
    tokenProgramId
  );

  let holderAccount;
  try {
    holderAccount = await getAccount(connection, holderAta, "confirmed", tokenProgramId);
  } catch (_) {
    throw new Error(
      "Associated token account not found for your wallet. Ensure you hold the NFT before running."
    );
  }

  // Basic uniqueness/safety check
  if (!args.force) {
    const totalSupply = Number(mintInfo.supply);
    const holderAmount = Number(holderAccount.amount);
    if (totalSupply !== 1 || holderAmount !== 1) {
      throw new Error(
        `Safety check failed (supply=${totalSupply}, youHold=${holderAmount}). ` +
          "Use --force if you know what you're doing."
      );
    }
  }

  if (holderAccount.isFrozen) {
    throw new Error(
      "Your token account is frozen; thaw it before burning/transferring."
    );
  }

  // 1) Compose memo text
  const memoText = `teleburn: ${inscriptionId} | solana_mint: ${mintPk.toBase58()} | sha256: ${sha256}`;
  const memoIx = {
    keys: [],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memoText, "utf8"),
  };

  // 2) Build main action ixs
  const ixs = [memoIx];

  if (args.method === "burn") {
    // Burn 1 token and close the (now-empty) ATA
    ixs.push(
      createBurnInstruction(
        holderAta,
        mintPk,
        payer.publicKey,
        1,
        [],
        tokenProgramId
      ),
      createCloseAccountInstruction(
        holderAta,
        payer.publicKey,
        payer.publicKey,
        [],
        tokenProgramId
      )
    );
  } else {
    // Transfer to incinerator ATA (creates it if missing), then close holder ATA
    const incAta = await getAssociatedTokenAddress(
      mintPk,
      INCINERATOR,
      true, // allow off-curve owner just in case
      tokenProgramId
    );

    const incAtaInfo = await connection.getAccountInfo(incAta);
    if (!incAtaInfo) {
      ixs.push(
        createAssociatedTokenAccountInstruction(
          payer.publicKey, // payer
          incAta,
          INCINERATOR,
          mintPk,
          tokenProgramId
        )
      );
    }

    ixs.push(
      createTransferInstruction(
        holderAta,
        incAta,
        payer.publicKey,
        1,
        [],
        tokenProgramId
      ),
      createCloseAccountInstruction(
        holderAta,
        payer.publicKey,
        payer.publicKey,
        [],
        tokenProgramId
      )
    );
  }

  // 3) Send!
  const tx = new Transaction().add(...ixs);
  tx.feePayer = payer.publicKey;
  const sig = await sendAndConfirmTransaction(connection, tx, [payer], {
    skipPreflight: false,
    commitment: "confirmed",
  });

  console.log("\n✅ Teleburn proof memo + action submitted.");
  console.log("   Solana transaction signature:", sig);
  console.log(`   Explorer: https://explorer.solana.com/tx/${sig}`);
  console.log("   Memo payload:\n   ", memoText);

  // 4) Optional: sanity check post-state (best effort)
  try {
    const postMint = await getMint(connection, mintPk, "confirmed", tokenProgramId);
    console.log(
      `   Post-state supply (raw): ${postMint.supply.toString()} (decimals=${postMint.decimals})`
    );
  } catch {
    /* ignore */
  }

  console.log("\n🧾 Save this pair in your docs:");
  console.log("   - BTC inscription ID:", inscriptionId);
  console.log("   - Solana tx signature:", sig);
}

main().catch((e) => {
  console.error("✗ Error:", e.message || e);
  process.exit(1);
});
