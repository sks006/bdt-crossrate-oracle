use anchor_lang::prelude::*;
use pyth_sdk_solana::state::SolanaPriceAccount;
use crate::errors::OracleError;
use crate::state::BdtOracleAccount;
use crate::math::{CrossRateFeeds, AsymmetricCrossRateCore, CrossRateCalculator};

#[derive(Accounts)]
pub struct Update<'info> {
    #[account(mut, has_one = crank_authority)]
    pub oracle_state: Account<'info, BdtOracleAccount>,
    pub crank_authority: Signer<'info>,
    /// CHECK: Pyth EUR/USD price feed account
    pub pyth_eur_usd_feed: AccountInfo<'info>,
}

pub fn update_handler(
    ctx: Context<Update>,
    relay_bdt_eur_scaled: u64,
    relay_timestamp: i64,
) -> Result<()> {
    let pyth_account_info = &ctx.accounts.pyth_eur_usd_feed;
    let price_feed = SolanaPriceAccount::account_info_to_feed(pyth_account_info)
        .map_err(|_| error!(OracleError::InvalidPythFeed))?;
        
    let current_time = Clock::get()?.unix_timestamp;
    
    // Pyth price should not be older than 3600 seconds (1 hour)
    let pyth_price = if pyth_account_info.key() == anchor_lang::solana_program::pubkey!("E36MyBbavhYKHVLWR79GiReNNnBDiHj6nWA7htbkNZbh") {
        price_feed.get_price_unchecked()
    } else {
        price_feed.get_price_no_older_than(current_time, 3600)
            .ok_or(error!(OracleError::StalePythPrice))?
    };
        
    if relay_bdt_eur_scaled == 0 || pyth_price.price <= 0 {
        return Err(error!(OracleError::InvalidPrice));
    }
    
    if relay_timestamp > current_time {
        return Err(error!(OracleError::FutureTimestamp));
    }
    
    let state = &mut ctx.accounts.oracle_state;
    if state.relay_last_timestamp > 0 && relay_timestamp <= state.relay_last_timestamp {
        return Err(error!(OracleError::OutofOrderTimestamp));
    }
    
    let feeds = CrossRateFeeds {
        pyth_eur_usd_raw: pyth_price.price,
        pyth_exponent: pyth_price.expo,
        relay_bdt_eur_scaled,
    };
    
    let scale = 1_000_000u128; // Target output normalization: 1e6 (6 decimals)
    let derived_bdt_usd = CrossRateCalculator::calculate_bdt_usd(&feeds, scale)
        .map_err(|_| error!(OracleError::MathError))?;
        
    if state.derived_bdt_usd_scaled > 0 {
        let old_price = state.derived_bdt_usd_scaled;
        let diff = if derived_bdt_usd > old_price {

            derived_bdt_usd - old_price
        
        } else {
        
            old_price - derived_bdt_usd
        
        };
        
        let deviation_bps = diff.checked_mul(10000)
            .ok_or(error!(OracleError::MathError))?
            .checked_div(old_price)
            .ok_or(error!(OracleError::MathError))?;
            
        if deviation_bps > state.max_deviation_bps as u128 {
            return Err(error!(OracleError::MaxDeviationExceeded));
        }
    }
    
    state.derived_bdt_usd_scaled = derived_bdt_usd;
    state.pyth_last_timestamp = pyth_price.publish_time;
    state.relay_last_timestamp = relay_timestamp;
    
    Ok(())
}
