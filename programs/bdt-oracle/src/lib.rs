use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod math;
pub mod state;

pub use instructions::*;

declare_id!("4Xg8ntPZ8LE616Tqy4r18vBUuftombmb1jp15d6dqwAp");

#[program]
pub mod bdt_oracle {
    use super::*;

    pub fn initialize_oracle(ctx: Context<Initialize>, max_deviation_bps: u32) -> Result<()> {
        instructions::initialize_handler(ctx, max_deviation_bps)
    }

    pub fn update_rate(
        ctx: Context<Update>,
        relay_bdt_eur_scaled: u64,
        relay_timestamp: i64,
    ) -> Result<()> {
        instructions::update_handler(ctx, relay_bdt_eur_scaled, relay_timestamp)
    }
}
