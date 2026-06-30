# bdt-crossrate-oracle
An enterprise-grade, high-efficiency Solana oracle program that synthesizes a real-time, fixed-point BDT/USD price feed. The architecture is explicitly decoupled into an asymmetric cross-rate engine: it matches a low-frequency, low-liquidity off-chain fiat leg (BDT/EUR) updated via a zero-cost serverless crank with a high-frequency on-chain leg
