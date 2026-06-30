use anchor_lang::prelude::*;

#[error_code]
pub enum OracleError {
    #[msg("Invalid price data provided.")]
    InvalidPrice,

    #[msg("Math overflow or underflow occurred.")]
    MathError,

    #[msg("Unauthorized signer.")]
    Unauthorized,
}
