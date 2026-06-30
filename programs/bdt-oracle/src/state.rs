use anchor_lang::prelude::*;

// STATE MEMORY LAYOUT - ZERO FUNCTIONAL METHOD IMPLEMENTATIONS
// Total Allocation: 8 (Discriminator) + 32 (Pubkey) + 16 (u128) + 8 (i64) + 8 (i64) + 4 (u32) = 76 Bytes

#[account]
pub struct BdtOracleAccount {
    pub crank_authority: Pubkey,
    pub derived_bdt_usd_scaled: u128,  // Target output normalization: 1e6 (6 decimals)
    pub pyth_last_timestamp: i64,      // Verified slot cluster time baseline
    pub relay_last_timestamp: i64,     // Injected runtime clock tracking
    pub max_deviation_bps: u32,        // System safety parameter
}

impl BdtOracleAccount {
    pub const LEN: usize = 8 + 32 + 16 + 8 + 8 + 4; // 76 Bytes
}
