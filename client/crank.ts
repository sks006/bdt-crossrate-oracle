import { Connection, PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import axios from "axios";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

function loadEnvFile(): void {
  const envPath = path.resolve(__dirname, "../.env");
  if (!fs.existsSync(envPath)) {
    return;
  }

  for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value.replace(/^['"]|['"]$/g, "");
    }
  }
}

loadEnvFile();

export interface ExchangeRatePayload {
  base_code: string;
  conversion_rates: {
    USD: number;
    EUR: number;
    BDT: number;
    [key: string]: number;
  };
}

export interface CrankEnvironment {
  rpcUrl: string;
  privateKeyRaw: string;
  programId: string;
}

export class BdtOracleCrank {
  private connection: Connection;
  private authority: Keypair;
  private program: anchor.Program;
  private oracleStateKeypair: Keypair;
  private pythFeed: PublicKey;

  constructor(env: CrankEnvironment) {
    this.connection = new Connection(env.rpcUrl, "confirmed");
    const secretKey = anchor.utils.bytes.bs58.decode(env.privateKeyRaw);
    this.authority = Keypair.fromSecretKey(secretKey);

    // Derive oracle state keypair deterministically from authority
    const hash = crypto
      .createHash("sha256")
      .update(this.authority.secretKey)
      .digest();
    this.oracleStateKeypair = Keypair.fromSeed(new Uint8Array(hash));

    // Debug: verify keypair derivation consistency
    console.debug(`[Init] Authority pubkey: ${this.authority.publicKey.toBase58()}`);
    console.debug(`[Init] Oracle state pubkey: ${this.oracleStateKeypair.publicKey.toBase58()}`);
    console.debug(`[Init] Program ID: ${env.programId}`);
    console.debug(`[Init] RPC URL: ${env.rpcUrl}`);

    const provider = new anchor.AnchorProvider(
      this.connection,
      new anchor.Wallet(this.authority),
      { preflightCommitment: "confirmed" },
    );

    // Load IDL
    const idlPath = path.resolve(__dirname, "../target/idl/bdt_oracle.json");
    if (!fs.existsSync(idlPath)) {
      throw new Error(`IDL not found at ${idlPath}. Run 'anchor build' first.`);
    }
    const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));
    this.program = new anchor.Program(idl, provider) as anchor.Program<any>;

    // Determine Pyth EUR/USD feed address
    const isMainnet =
      env.rpcUrl.includes("mainnet") || env.rpcUrl.includes("api.mainnet-beta");
    this.pythFeed = isMainnet
      ? new PublicKey("HeGExgu926687pc49M82823mdK913JpdS5vmNhM7mZcZ")
      : new PublicKey("E36MyBbavhYKHVLWR79GiReNNnBDiHj6nWA7htbkNZbh");
  }

  /**
   * Fetches the exchange rates and calculates the BDT/EUR cross rate scaled to 1e9.
   */
  async fetchAndCrossMultiply(
    endpoint: string,
  ): Promise<{ scaledRatio: number; timestamp: number }> {
    console.log(`Fetching exchange rates from ${endpoint}...`);
    const response = await axios.get<ExchangeRatePayload>(endpoint);
    const payload = response.data;

    if (
      !payload.conversion_rates ||
      !payload.conversion_rates.BDT ||
      !payload.conversion_rates.EUR
    ) {
      throw new Error(
        "Invalid exchange rate payload: BDT or EUR rates missing.",
      );
    }

    const bdtPerUsd = payload.conversion_rates.BDT;
    const eurPerUsd = payload.conversion_rates.EUR;

    // Compute cross rate
    const bdtPerEur = bdtPerUsd / eurPerUsd;

    // Scale to 1e9
    const scaledRatio = Math.floor(bdtPerEur * 1_000_000_000);
    const timestamp = Math.floor(Date.now() / 1000);

    console.log(`USD/BDT: ${bdtPerUsd}, USD/EUR: ${eurPerUsd}`);
    console.log(`Derived BDT/EUR: ${bdtPerEur} (scaled: ${scaledRatio})`);

    return { scaledRatio, timestamp };
  }

  /**
   * Initializes the oracle state account if it does not already exist.
   */
  async ensureInitialized(maxDeviationBps: number = 500): Promise<void> {
    const statePubkey = this.oracleStateKeypair.publicKey;
    console.log(`Checking oracle state account: ${statePubkey.toBase58()}`);

    const accountInfo = await this.connection.getAccountInfo(statePubkey);
    if (accountInfo === null) {
      console.log("Oracle state account not found. Initializing...");
      const tx = await this.program.methods
        .initializeOracle(maxDeviationBps)
        .accounts({
          oracleState: this.oracleStateKeypair.publicKey,
          authority: this.authority.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([this.oracleStateKeypair])
        .rpc();

      console.log(`Initialization transaction signature: ${tx}`);
      // Wait for confirmation
      await this.connection.confirmTransaction(tx, "confirmed");
      console.log("Oracle state account successfully initialized.");
    } else {
      console.log("Oracle state account already initialized.");
    }
  }

  /**
   * Submits the scaled ratio and timestamp to the on-chain program.
   */
  async broadcastToSolana(
    scaledRatio: number,
    timestamp: number,
  ): Promise<string> {
    await this.ensureInitialized();

    console.log("Broadcasting price update to Solana...");
    const tx = await this.program.methods
      .updateRate(new anchor.BN(scaledRatio), new anchor.BN(timestamp))
      .accounts({
        oracleState: this.oracleStateKeypair.publicKey,
        crankAuthority: this.authority.publicKey,
        pythEurUsdFeed: this.pythFeed,
      })
      .rpc();

    console.log(`Update transaction signature: ${tx}`);
    return tx;
  }
}

// Entrypoint for CLI execution
async function main() {
  const rpcUrl = process.env.RPC_URL?.trim() || "https://api.devnet.solana.com";
  const privateKeyRaw = process.env.CRANK_PRIVATE_KEY?.trim();
  const programId =
    process.env.PROGRAM_ID?.trim() ||
    "4Xg8ntPZ8LE616Tqy4r18vBUuftombmb1jp15d6dqwAp";

  if (!privateKeyRaw) {
    console.error("CRANK_PRIVATE_KEY environment variable is required.");
    process.exit(1);
  }

  try {
    const crank = new BdtOracleCrank({ rpcUrl, privateKeyRaw, programId });

    const apiKey = process.env.EXCHANGE_RATE_API_KEY?.trim();
    if (!apiKey) {
      console.error("EXCHANGE_RATE_API_KEY environment variable is required.");
      process.exit(1);
    }

    const endpoint = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`;
    const { scaledRatio, timestamp } =
      await crank.fetchAndCrossMultiply(endpoint);

    // Broadcast update
    const signature = await crank.broadcastToSolana(scaledRatio, timestamp);
    console.log(`Successfully updated oracle state! Signature: ${signature}`);
  } catch (error) {
    console.error("Crank execution failed:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
