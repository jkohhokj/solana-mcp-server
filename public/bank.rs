use anchor_lang::prelude::*;

// This is your program's public key and it will update automatically when you build the project.
declare_id!("BFjpSGu7uVUgk3F5EJWbhKMqFhnKYK6KyLfqMjsW2YW2");

#[program]
mod bank_program {
    use super::*;

    // Deposit funds into the account and emit an event
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        let bank_account = &mut ctx.accounts.bank_account;
        bank_account.balance += amount;
        emit!(DepositEvent {
            owner: ctx.accounts.signer.key(),
            amount,
            new_balance: bank_account.balance,
        });
        msg!(
            "Deposited {} into the account. New balance: {}",
            amount,
            bank_account.balance
        );
        Ok(())
    }

    // Withdraw funds from the account and emit an event
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let bank_account = &mut ctx.accounts.bank_account;

        // Check if there are sufficient funds for withdrawal
        if bank_account.balance < amount {
            return Err(ErrorCode::InsufficientBalance.into());
        }

        bank_account.balance -= amount;
        emit!(WithdrawEvent {
            owner: ctx.accounts.signer.key(),
            amount,
            new_balance: bank_account.balance,
        });
        msg!(
            "Withdrew {} from the account. New balance: {}",
            amount,
            bank_account.balance
        );
        Ok(())
    }

    // Get the balance and emit an event
    pub fn get_balance(ctx: Context<GetBalance>) -> Result<()> {
        let bank_account = &ctx.accounts.bank_account;
        emit!(GetBalanceEvent {
            owner: ctx.accounts.signer.key(),
            balance: bank_account.balance,
        });
        msg!("Account balance: {}", bank_account.balance);
        Ok(())
    }

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let bank_account = &mut ctx.accounts.bank_account;
        bank_account.balance = 0;
        msg!("Bank account initialized with balance: 0");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = signer, space = 8 + 8)]
    pub bank_account: Account<'info, BankAccount>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub bank_account: Account<'info, BankAccount>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub bank_account: Account<'info, BankAccount>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GetBalance<'info> {
    #[account()]
    pub bank_account: Account<'info, BankAccount>,
    pub signer: Signer<'info>,
}

#[account]
pub struct BankAccount {
    pub balance: u64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Insufficient balance to complete the transaction.")]
    InsufficientBalance,
}

// Define custom events to emit during each function

#[event]
pub struct DepositEvent {
    pub owner: Pubkey,
    pub amount: u64,
    pub new_balance: u64,
}

#[event]
pub struct WithdrawEvent {
    pub owner: Pubkey,
    pub amount: u64,
    pub new_balance: u64,
}

#[event]
pub struct GetBalanceEvent {
    pub owner: Pubkey,
    pub balance: u64,
}
