use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod math;
pub mod state;

use instructions::{ initialize::*, update::* };

declare_id!("BDTOracle1111111111111111111111111111111111");

#[program]
pub mod bdt_oracle {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        initialize::handler(ctx)
    }

    pub fn update(ctx: Context<Update>, bdt_eur_price: i128, eur_usd_price: i128) -> Result<()> {
        update::handler(ctx, bdt_eur_price, eur_usd_price)
    }
}
