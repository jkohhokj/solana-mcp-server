


# Solana MCP Server

A Model-Context-Protocol server for interacting with the Solana blockchain. This server provides simple RPC endpoints for common Solana operations.

## Features

- getSlot
- getBalance
- getKeypairInfo
- getAccountInfo
- transfer
- requestAirdrop
- runAnchorTests
- getRecentTransactions
- getTokenAccounts
- getTokenAndStakeAccounts
- getTxsLast24Hours
- detectAnomalies
- convertCurrency
- createWallet

## Quickstart

clone and install dependencies:

```bash
git clone https://github.com/yourusername/solana-mcp-server.git
cd solana-mcp-server
npm install
```

build the tool

```bash
npm run build
```

if above doesn't work do this

```bash
wsl
npx tsc
```

add the tool to your claude_desktop_config.json
```
{
  "mcpServers": {
    "solana-rpc": {
      "command": "node",
      "args": [
        "C:\\PATH\\build\\index.js"
      ]
    }
  }
}
```

add these preferences to Claude Desktop
```
keep responses for the layperson, if there is deep technical jargon involved, make sure to explain it. if the prompt includes incorrect terminology explain the relevant blockchain terminology
if the prompt implies basic functionality include: getslot, getbalance, getkeypairinfo (if applicable), getaccountinfo, convertcurrency, gettokenandstakeaccounts of account balance
if the prompt implies data/analysis/summary/history include visual artifacts if the prompt includes explaining/describing/visualizing include visual artifacts
```


## Demo Prompts

### Start an Account

```
make a devnet account and fund it
```
```
send 1 sol to 95Ymj3Y5k2XDZMjCG9m3ZYKuvfALFi9iKfQfGsoLLqsF then describe the new account
```
```
update the visual
```

### Transact Account
```
describe 95Ymj3Y5k2XDZMjCG9m3ZYKuvfALFi9iKfQfGsoLLqsF
```
```
burn .1 sol using WALLET_KEY
```

### Program Interaction
```
Test this Solana program on devnet using the MCP server:

DEPLOYED PROGRAM ID:
G8XePi8D2k4VSexUNFqc48uVdt6uEhXX3vHqou6yWAkF

WALLET KEYPAIR:
WALLET_KEYPAIR

WORKING DIRECTORY:
C:\Users\jkohh\Downloads\project\anchor-tests

1. Analyze the Rust source code to determine:
   - All function signatures and their parameters
   - All account structures and their fields
   - PDA seeds (if any)
   - Account constraints (#[account(...)])
2. Generate a comprehensive IDL from the source code
3. Create 2 tests 
4. Use CommonJS format with hardcoded values
5. Calculate discriminators from function names
6. Return transaction signatures and verification links

ATTACH HELLO WORLD SOURCE CODE
```
```
describe the program called
```

### Bank Interaction (non deterministic)
 
```
**System:** Windows (not WSL)

**Working Directory:** 
C:\Users\jkohh\Downloads\project\anchor-tests

**Dependencies Installed:**
- @coral-xyz/anchor (v0.29.0)
- @coral-xyz/borsh (v0.29.0)  
- @solana/web3.js (v1.87.0)

**Network:** Solana Devnet (https://api.devnet.solana.com)

**Program ID:** BFjpSGu7uVUgk3F5EJWbhKMqFhnKYK6KyLfqMjsW2YW2

**Wallet Secret Key:**
WALLET_KEY

**Wallet Public Key:** 95Ymj3Y5k2XDZMjCG9m3ZYKuvfALFi9iKfQfGsoLLqsF

**MCP Tool:** Use `solana-rpc:runAnchorTests` with the Windows path above
Test this Solana program using RAW TransactionInstruction (not Anchor Program class):

Network: devnet

source code attached 

Requirements:
- Manual discriminators (SHA256 first 8 bytes)
- Raw web3.js transactions only
- Manual borsh decoding and encoding
- Test: initialize, deposit, withdraw
- Print explorer links
- make it a standalone script instead of using the test framework

Working directory: C:\Users\jkohh\Downloads\project\anchor-tests

run the test and validate the response

ATTACH THE BANK SOURCE CODE
```

## RPC Endpoint

The server connects to Solana's mainnet at `https://api.mainnet-beta.solana.com`. To use a different network (like devnet or testnet), modify the `SOLANA_RPC` constant in `src/index.ts`.
