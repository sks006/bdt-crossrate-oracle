import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { BdtOracle } from "../target/types/bdt_oracle";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";

describe("bdt-oracle", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.BdtOracle as Program<BdtOracle>;

  const oracleStateKeypair = Keypair.generate();
  // Using official Devnet EUR/USD price feed
  const pythFeed = new PublicKey("HQ2t2YrgoFB2sLq7GeyT5nzx5EMsc1DfWce1a42KHobc");

  // Use a deterministic base time in the past to prevent "FutureTimestamp" errors
  // due to small clock differences between the host and the local validator.
  const baseTime = Math.floor(Date.now() / 1000) - 30;

  it("Initializes the oracle state", async () => {
    const maxDeviationBps = 500; // 5%

    await program.methods
      .initializeOracle(maxDeviationBps)
      .accounts({
        oracleState: oracleStateKeypair.publicKey,
        authority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      } as any)
      .signers([oracleStateKeypair])
      .rpc();

    const state = await program.account.bdtOracleAccount.fetch(oracleStateKeypair.publicKey);
    assert.equal(state.crankAuthority.toBase58(), provider.wallet.publicKey.toBase58());
    assert.equal(state.maxDeviationBps, maxDeviationBps);
    assert.equal(state.derivedBdtUsdScaled.toString(), "0");
  });

  it("Updates the oracle state with valid cross rate", async () => {
    const relayBdtEurScaled = new anchor.BN("128205128205"); // 128.205128205 BDT per EUR (scaled 1e9)

    try {
      await program.methods
        .updateRate(relayBdtEurScaled, new anchor.BN(baseTime))
        .accounts({
          oracleState: oracleStateKeypair.publicKey,
          crankAuthority: provider.wallet.publicKey,
          pythEurUsdFeed: pythFeed,
        } as any)
        .rpc();
    } catch (err: any) {
      console.log("Transaction Logs:", err.logs);
      throw err;
    }

    const state = await program.account.bdtOracleAccount.fetch(oracleStateKeypair.publicKey);
    console.log("Updated BDT/USD Rate (6 decimals):", state.derivedBdtUsdScaled.toString());
    assert.isTrue(state.derivedBdtUsdScaled.gt(new anchor.BN(0)));
    assert.equal(state.relayLastTimestamp.toNumber(), baseTime);
  });

  it("Fails when updating with stale or out-of-order timestamp", async () => {
    const relayBdtEurScaled = new anchor.BN("128205128205");
    const oldTimestamp = baseTime - 10; // Less than baseTime, so it is out of order

    try {
      await program.methods
        .updateRate(relayBdtEurScaled, new anchor.BN(oldTimestamp))
        .accounts({
          oracleState: oracleStateKeypair.publicKey,
          crankAuthority: provider.wallet.publicKey,
          pythEurUsdFeed: pythFeed,
        } as any)
        .rpc();
      assert.fail("Should have failed with OutofOrderTimestamp");
    } catch (err: any) {
      assert.include(err.message, "OutofOrderTimestamp");
    }
  });

  it("Fails when deviation limit is exceeded", async () => {
    const massiveBdtEurScaled = new anchor.BN("192307692307");
    const newTimestamp = baseTime + 10; // Greater than baseTime, but still in the past (baseTime was now - 30)

    try {
      await program.methods
        .updateRate(massiveBdtEurScaled, new anchor.BN(newTimestamp))
        .accounts({
          oracleState: oracleStateKeypair.publicKey,
          crankAuthority: provider.wallet.publicKey,
          pythEurUsdFeed: pythFeed,
        } as any)
        .rpc();
      assert.fail("Should have failed with MaxDeviationExceeded");
    } catch (err: any) {
      assert.include(err.message, "MaxDeviationExceeded");
    }
  });
});
