use anchor_lang::prelude::*;

#[account]
pub struct OracleState {
    pub authority: Pubkey,
    pub bdt_eur_price: i128,
    pub eur_usd_price: i128,
    pub last_update_slot: u64,
}

impl OracleState {
    pub const LEN: usize = 8 + 32 + 16 + 16 + 8;
}
