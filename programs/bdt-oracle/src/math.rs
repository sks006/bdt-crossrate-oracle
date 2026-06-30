use anchor_lang::prelude::*;

pub fn multiply_fixed(a: i128, b: i128) -> Result<i128> {
    a.checked_mul(b).ok_or(error!(crate::errors::OracleError::MathError))
}

pub fn divide_fixed(a: i128, b: i128) -> Result<i128> {
    if b == 0 {
        return Err(error!(crate::errors::OracleError::MathError));
    }
    a.checked_div(b).ok_or(error!(crate::errors::OracleError::MathError))
}
