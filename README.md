# bdt-crossrate-oracle
An enterprise-grade, high-efficiency Solana oracle program that synthesizes a real-time, fixed-point BDT/USD price feed. The architecture is explicitly decoupled into an asymmetric cross-rate engine: it matches a low-frequency, low-liquidity off-chain fiat leg (BDT/EUR) updated via a zero-cost serverless crank with a high-frequency on-chain leg

```
bdt-crossrate-oracle/
├── Anchor.toml
├── Cargo.toml
├── programs/
│   └── bdt-oracle/
│       ├── src/
│       │   ├── lib.rs                  # Instruction routing and program entries
│       │   ├── errors.rs                # Math and temporal verification failure enums
│       │   ├── state.rs                 # Byte-aligned on-chain account structures
│       │   ├── math.rs                  # Multi-decimal fixed-point arithmetic engine
│       │   └── instructions/
│       │       ├── mod.rs
│       │       ├── initialize.rs        # Initialization of the state authority
│       │       └── update.rs            # Crank execution loop and validation checks
└── .github/
    └── workflows/
        └── crank.yml                   # Ephemeral 30-minute cron workflow

```
