use crate::errors::OracleMathError;

// ABSTRACT TRAIT BOUNDS - NO INLINE EXECUTABLE LOGIC

pub struct CrossRateFeeds {
    pub pyth_eur_usd_raw: i64,     // Base precision: 1e8 from Pyth network
    pub pyth_exponent: i32,        // Inbound dynamically parsed exponent field
    pub relay_bdt_eur_scaled: u64, // Base precision: 1e9 from serverless relayer
}

pub trait AsymmetricCrossRateCore {
    type IntermediateValue;
    type NormalizationScale;
    
    /// Fuses Pyth's liquid EUR/USD rate with the relayed BDT/EUR ratio.
    /// Scales inputs to 1e18 intermediate buffers to safely process multiplication,
    /// then normalizes down to exactly 6 decimals.
    fn calculate_bdt_usd(
        feeds: &CrossRateFeeds,
        scale: Self::NormalizationScale,
    ) -> Result<u128, OracleMathError>;
}

pub struct CrossRateCalculator;

impl AsymmetricCrossRateCore for CrossRateCalculator {
    type IntermediateValue = u128;
    type NormalizationScale = u128;

    fn calculate_bdt_usd(
        feeds: &CrossRateFeeds,
        scale: Self::NormalizationScale,
    ) -> Result<u128, OracleMathError> {
        if feeds.pyth_eur_usd_raw <= 0 {
            return Err(OracleMathError::InvalidInput);
        }
        
        let pyth_raw = feeds.pyth_eur_usd_raw as u128;
        let expo = feeds.pyth_exponent;
        
        // Scale Pyth price to 1e18 intermediate buffer
        // Pyth price has exponent `expo` (typically -8)
        // P_18 = pyth_raw * 10^(18 + expo)
        let p_18 = if expo >= -18 {
            let multiplier = 10u128.checked_pow((18 + expo) as u32)
                .ok_or(OracleMathError::Overflow)?;
            pyth_raw.checked_mul(multiplier)
                .ok_or(OracleMathError::Overflow)?
        } else {
            let divisor = 10u128.checked_pow((-18 - expo) as u32)
                .ok_or(OracleMathError::Overflow)?;
            pyth_raw.checked_div(divisor)
                .ok_or(OracleMathError::Underflow)?
        };
        
        // Scale Relay price to 1e18 intermediate buffer
        // Relay price has 9 decimals (1e9)
        // R_18 = relay_bdt_eur_scaled * 10^9
        let r_18 = (feeds.relay_bdt_eur_scaled as u128)
            .checked_mul(10u128.pow(9))
            .ok_or(OracleMathError::Overflow)?;
            
        // Multiply intermediate values (both 1e18)
        // Product is 1e36.
        // We want to normalize to `scale` (e.g. 1e6).
        // So we divide by 1e36 / scale = 1e30 (if scale is 1e6).
        let product = r_18.checked_mul(p_18)
            .ok_or(OracleMathError::Overflow)?;
            
        let divisor = 10u128.pow(36)
            .checked_div(scale)
            .ok_or(OracleMathError::Underflow)?;
            
        let result = product.checked_div(divisor)
            .ok_or(OracleMathError::Underflow)?;
            
        Ok(result)
    }
}
