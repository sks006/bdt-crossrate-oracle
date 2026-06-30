# bdt-crossrate-oracle
An enterprise-grade, high-efficiency Solana oracle program that synthesizes a real-time, fixed-point BDT/USD price feed. The architecture is explicitly decoupled into an asymmetric cross-rate engine: it matches a low-frequency, low-liquidity off-chain fiat leg  updated via a zero-cost serverless crank with a high-frequency on-chain leg

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
