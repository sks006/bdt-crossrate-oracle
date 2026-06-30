use anchor_lang::prelude::*;

#[error_code]
pub enum OracleError {
    #[msg("Invalid price data provided.")]
    InvalidPrice,

    #[msg("Math overflow or underflow occurred.")]
    MathError,

    #[msg("Unauthorized signer.")]
    Unauthorized,

    #[msg("Failed to parse Pyth price feed.")]
    InvalidPythFeed,

    #[msg("Pyth price feed is stale.")]
    StalePythPrice,

    #[msg("Relayed timestamp is in the future.")]
    FutureTimestamp,

    #[msg("Relayed timestamp is older or equal to the last recorded timestamp.")]
    OutofOrderTimestamp,

    #[msg("Price deviation exceeds the safety threshold.")]
    MaxDeviationExceeded,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OracleMathError {
    InvalidInput,
    Overflow,
    Underflow,
}
