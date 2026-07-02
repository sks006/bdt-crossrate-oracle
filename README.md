# BDT Crossrate Oracle

An enterprise-grade, high-efficiency Solana oracle program that synthesizes a real-time, fixed-point BDT/USD price feed. The architecture is explicitly decoupled into an asymmetric cross-rate engine: it matches a low-frequency, low-liquidity off-chain fiat leg updated via a zero-cost serverless crank with a high-frequency on-chain leg.

```
bdt-crossrate-oracle/
├── Anchor.toml
├── Cargo.toml
├── package.json
├── tsconfig.json
├── .github/
│   └── workflows/
│       └── crank.yml               # Ephemeral 1-hour cron executor
├── client/
│   └── crank.ts                    # Stateless TS execution loop with cross-rate calculation
└── programs/
    └── bdt-oracle/
        ├── Cargo.toml
        └── src/
            ├── lib.rs              # Zero-logic compile-time instruction routing
            ├── errors.rs            # Mathematical/temporal verification codes
            ├── state.rs             # 76-byte static memory layout mapping
            ├── math.rs              # Fixed-point u128 cross-rate arithmetic boundaries
            └── instructions/
                ├── mod.rs           # Module namespace flattening
                ├── initialize.rs    # Program state configuration context
                └── update.rs        # Ingestion, validation, and write loops
```

---

## On-Chain Deployments (Devnet)

- **Program ID**: `4Xg8ntPZ8LE616Tqy4r18vBUuftombmb1jp15d6dqwAp`
- **BDT/USD Oracle Price Feed Account**: `CCW6UZ3uf2Y4XKc6XgE3A1Y9hn74AdzKjqoTZ9dk7vmj`

---

## Oracle State Account Layout

The state account uses a static memory layout of exactly **76 bytes** (including the 8-byte Anchor discriminator). All values are stored in **little-endian (LE)** format.

| Offset (Bytes) | Field Name | Type | Description |
| :--- | :--- | :--- | :--- |
| `0 - 8` | Anchor Discriminator | `[u8; 8]` | Auto-generated struct identifier |
| `8 - 40` | `crank_authority` | `Pubkey` | Authorized authority that can submit updates |
| `40 - 56` | `derived_bdt_usd_scaled` | `u128` | **BDT/USD Price scaled to 6 decimals (1e6)** |
| `56 - 64` | `pyth_last_timestamp` | `i64` | Timestamp of the last processed Pyth price update |
| `64 - 72` | `relay_last_timestamp`| `i64` | Timestamp of the last processed off-chain relayer update |
| `72 - 76` | `max_deviation_bps` | `u32` | Max allowed basis point deviation between updates |

---

## Integration & Consumption Guide

### 1. TypeScript / JavaScript Consumption

You can fetch and decode the oracle state directly using `@solana/web3.js` without any Anchor dependencies.

```typescript
import { Connection, PublicKey } from "@solana/web3.js";

// BDT/USD Feed Address on Devnet
const ORACLE_STATE_ADDRESS = new PublicKey("CCW6UZ3uf2Y4XKc6XgE3A1Y9hn74AdzKjqoTZ9dk7vmj");
const connection = new Connection("https://api.devnet.solana.com", "confirmed");

async function fetchBdtUsdPrice(): Promise<number> {
  const accountInfo = await connection.getAccountInfo(ORACLE_STATE_ADDRESS);
  if (!accountInfo) {
    throw new Error("Oracle state account not found");
  }

  // Parse derived_bdt_usd_scaled (u128 LE at offset 40)
  const priceBuffer = accountInfo.data.slice(40, 56);
  const low = priceBuffer.readBigUInt64LE(0);
  const high = priceBuffer.readBigUInt64LE(8);
  const priceScaled = low | (high << 64n);

  // Divide by 1e6 normalizer to get real BDT/USD price
  const price = Number(priceScaled) / 1_000_000;
  
  // Parse last update timestamp (offset 64)
  const lastUpdate = Number(accountInfo.data.readBigInt64LE(64));

  console.log(`BDT/USD Price: ${price} BDT (Last updated: ${new Date(lastUpdate * 1000).toLocaleString()})`);
  return price;
}

fetchBdtUsdPrice().catch(console.error);
```

### 2. Rust (Solana Program CPI / Deserialization)

In your Solana program, define the oracle state layout and deserialize it directly from the accounts.

#### Account Definition
```rust
use anchor_lang::prelude::*;

#[account]
pub struct BdtOracleAccount {
    pub crank_authority: Pubkey,
    pub derived_bdt_usd_scaled: u128,  // Target output normalization: 1e6 (6 decimals)
    pub pyth_last_timestamp: i64,
    pub relay_last_timestamp: i64,
    pub max_deviation_bps: u32,
}
```

#### Consumer Handler Code
```rust
use anchor_lang::prelude::*;
use crate::BdtOracleAccount;

#[derive(Accounts)]
pub struct ConsumePrice<'info> {
    /// CHECK: Validated in instruction handler
    pub bdt_oracle: Account<'info, BdtOracleAccount>,
}

pub fn handle_consume_price(ctx: Context<ConsumePrice>) -> Result<()> {
    let oracle = &ctx.accounts.bdt_oracle;
    
    // Retrieve the scaled BDT/USD price (6 decimals)
    let scaled_price: u128 = oracle.derived_bdt_usd_scaled;
    
    // Check for age / staleness
    let current_time = Clock::get()?.unix_timestamp;
    let staleness_threshold = 3600; // 1 hour safety margin
    
    require!(
        current_time - oracle.relay_last_timestamp <= staleness_threshold,
        ErrorCode::StalePriceFeed
    );

    msg!("Current BDT/USD Price: {}.{:06}", scaled_price / 1_000_000, scaled_price % 1_000_000);
    Ok(())
}

#[error_code]
pub enum ErrorCode {
    #[msg("The BDT/USD price feed is stale.")]
    StalePriceFeed,
}
```

---

## Local Development & Testing

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run tests**:
   ```bash
   anchor test
   ```

3. **Run the manual crank**:
   ```bash
   npm run crank
   ```
