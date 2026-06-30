import { Connection, PublicKey, Keypair } from "@solana/web3.js";

async function runCrank(): Promise<void> {
  const connection = new Connection("https://api.devnet.solana.com");
  const programId = new PublicKey("BDTOracle1111111111111111111111111111111111");
  const payer = Keypair.generate();

  console.log("Crank started", programId.toBase58());
  // TODO: implement stateless update loop with off-chain price hydration.
}

runCrank().catch((err) => {
  console.error(err);
  process.exit(1);
});
