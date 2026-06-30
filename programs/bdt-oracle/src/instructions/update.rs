use anchor_lang::prelude::*;
use crate::{errors::OracleError, state::OracleState};

#[derive(Accounts)]
pub struct Update<'info> {
    #[account(mut, has_one = authority)]
    pub oracle_state: Account<'info, OracleState>,
    pub authority: Signer<'info>,
}

pub fn handler(ctx: Context<Update>, bdt_eur_price: i128, eur_usd_price: i128) -> Result<()> {
    if bdt_eur_price <= 0 || eur_usd_price <= 0 {
        return Err(error!(OracleError::InvalidPrice));
    }

    let state = &mut ctx.accounts.oracle_state;
    state.bdt_eur_price = bdt_eur_price;
    state.eur_usd_price = eur_usd_price;
    state.last_update_slot = Clock::get()?.slot;
    Ok(())
}
