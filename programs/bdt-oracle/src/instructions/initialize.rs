use anchor_lang::prelude::*;
use crate::state::OracleState;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = authority, space = OracleState::LEN)]
    pub oracle_state: Account<'info, OracleState>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Initialize>) -> Result<()> {
    let state = &mut ctx.accounts.oracle_state;
    state.authority = ctx.accounts.authority.key();
    state.bdt_eur_price = 0;
    state.eur_usd_price = 0;
    state.last_update_slot = Clock::get()?.slot;
    Ok(())
}
