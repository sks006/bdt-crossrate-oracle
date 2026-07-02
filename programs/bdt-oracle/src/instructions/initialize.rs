use crate::state::BdtOracleAccount;
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = BdtOracleAccount::LEN
    )]
    pub oracle_state: Account<'info, BdtOracleAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_handler(ctx: Context<Initialize>, max_deviation_bps: u32) -> Result<()> {
    let state = &mut ctx.accounts.oracle_state;
    state.crank_authority = ctx.accounts.authority.key();
    state.derived_bdt_usd_scaled = 0;
    state.pyth_last_timestamp = 0;
    state.relay_last_timestamp = 0;
    state.max_deviation_bps = max_deviation_bps;
    Ok(())
}
