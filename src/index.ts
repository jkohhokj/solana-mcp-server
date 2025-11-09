import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
  ParsedAccountData,
} from "@solana/web3.js";
import { z } from "zod";
import bs58 from "bs58";
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import * as ts from "typescript";

const execPromise = promisify(exec);

const SOLANA_RPC = "https://api.devnet.solana.com";
const SOLANA_NET = "devnet";

// Create server instance
const server = new McpServer({
  name: "solana-rpc",
  version: "1.0.0",
});

// Initialize Solana connection
const connection = new Connection(SOLANA_RPC, "confirmed");

// Register Solana tools
server.tool("getSlot", "Get the current slot", {}, async () => {
  try {
    const slot = await connection.getSlot();
    return {
      content: [
        {
          type: "text",
          text: `Current slot: ${slot}`,
        },
      ],
    };
  } catch (err) {
    const error = err as Error;
    return {
      content: [
        {
          type: "text",
          text: `Failed to retrieve current slot: ${error.message}`,
        },
      ],
    };
  }
});

server.tool(
  "getBalance",
  "Get balance for a Solana address",
  {
    address: z.string().describe("Solana account address"),
  },
  async ({ address }) => {
    try {
      const publicKey = new PublicKey(address);
      const balance = await connection.getBalance(publicKey);
      const solBalance = balance / LAMPORTS_PER_SOL;

      return {
        content: [
          {
            type: "text",
            text: `Balance for ${address}:\n${solBalance} SOL`,
          },
        ],
      };
    } catch (err) {
      const error = err as Error;
      return {
        content: [
          {
            type: "text",
            text: `Failed to retrieve balance for address: ${error.message}`,
          },
        ],
      };
    }
  }
);

server.tool(
  "getKeypairInfo",
  "Get information about a keypair from its secret key",
  {
    secretKey: z
      .string()
      .describe("Base58 encoded secret key or array of bytes"),
  },
  async ({ secretKey }) => {
    try {
      let keypair: Keypair;
      try {
        const decoded = Uint8Array.from(
          secretKey.split(",").map((num) => parseInt(num.trim()))
        );
        keypair = Keypair.fromSecretKey(decoded);
      } catch {
        keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secretKey)));
      }

      const publicKey = keypair.publicKey;
      const balance = await connection.getBalance(publicKey);
      const accountInfo = await connection.getAccountInfo(publicKey);

      return {
        content: [
          {
            type: "text",
            text: `Keypair Information:
Public Key: ${publicKey.toBase58()}
Balance: ${balance / LAMPORTS_PER_SOL} SOL
Account Program Owner: ${accountInfo?.owner?.toBase58() || "N/A"}
Account Size: ${accountInfo?.data.length || 0} bytes
Is Executable: ${accountInfo?.executable || false}
Rent Epoch: ${accountInfo?.rentEpoch || 0}`,
          },
        ],
      };
    } catch (err) {
      const error = err as Error;
      return {
        content: [
          {
            type: "text",
            text: `Failed to retrieve keypair information: ${error.message}`,
          },
        ],
      };
    }
  }
);

server.tool(
  "getAccountInfo",
  "Get detailed account information for a Solana address",
  {
    address: z.string().describe("Solana account address"),
    encoding: z
      .enum(["base58", "base64", "jsonParsed"])
      .optional()
      .describe("Data encoding format"),
  },
  async ({ address, encoding = "base64" }) => {
    try {
      const publicKey = new PublicKey(address);
      const accountInfo = await connection.getAccountInfo(
        publicKey,
        "confirmed"
      );

      if (!accountInfo) {
        return {
          content: [
            {
              type: "text",
              text: `No account found for address: ${address}`,
            },
          ],
        };
      }

      let formattedData: string;
      if (encoding === "base58") {
        formattedData = bs58.encode(accountInfo.data);
      } else if (encoding === "base64") {
        formattedData = Buffer.from(accountInfo.data).toString("base64");
      } else {
        formattedData = Buffer.from(accountInfo.data).toString("base64");
      }

      return {
        content: [
          {
            type: "text",
            text: `Account Information for ${address}:
Lamports: ${accountInfo.lamports} (${
              accountInfo.lamports / LAMPORTS_PER_SOL
            } SOL)
Owner: ${accountInfo.owner.toBase58()}
Executable: ${accountInfo.executable}
Rent Epoch: ${accountInfo.rentEpoch}
Data Length: ${accountInfo.data.length} bytes
Data (${encoding}): ${formattedData}`,
          },
        ],
      };
    } catch (err) {
      const error = err as Error;
      return {
        content: [
          {
            type: "text",
            text: `Failed to retrieve account information: ${error.message}`,
          },
        ],
      };
    }
  }
);

server.tool(
  "transfer",
  "Transfer SOL from your keypair to another address",
  {
    secretKey: z
      .string()
      .describe(
        "Your keypair's secret key (as comma-separated numbers or JSON array)"
      ),
    toAddress: z.string().describe("Destination wallet address"),
    amount: z.number().positive().describe("Amount of SOL to send"),
  },
  async ({ secretKey, toAddress, amount }) => {
    try {
      let fromKeypair: Keypair;
      try {
        const decoded = Uint8Array.from(
          secretKey.split(",").map((num) => parseInt(num.trim()))
        );
        fromKeypair = Keypair.fromSecretKey(decoded);
      } catch {
        fromKeypair = Keypair.fromSecretKey(
          Uint8Array.from(JSON.parse(secretKey))
        );
      }

      const lamports = amount * LAMPORTS_PER_SOL;

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: fromKeypair.publicKey,
          toPubkey: new PublicKey(toAddress),
          lamports,
        })
      );

      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [fromKeypair]
      );

      return {
        content: [
          {
            type: "text",
            text: `Transfer successful!
From: ${fromKeypair.publicKey.toBase58()}
To: ${toAddress}
Amount: ${amount} SOL
Transaction signature: ${signature}
Explorer URL: https://explorer.solana.com/tx/${signature}?cluster=devnet`,
          },
        ],
      };
    } catch (err) {
      const error = err as Error;
      return {
        content: [
          {
            type: "text",
            text: `Failed to transfer SOL: ${error.message}`,
          },
        ],
      };
    }
  }
);

server.tool(
  "requestAirdrop",
  "Request SOL airdrop on devnet (for testing)",
  {
    address: z.string().describe("Recipient address"),
    amount: z
      .number()
      .min(0.1)
      .max(5)
      .describe("Amount of SOL to request (0.1-5)"),
  },
  async ({ address, amount }) => {
    try {
      const publicKey = new PublicKey(address);
      const lamports = amount * LAMPORTS_PER_SOL;

      const signature = await connection.requestAirdrop(publicKey, lamports);
      await connection.confirmTransaction(signature);

      return {
        content: [
          {
            type: "text",
            text: `Airdrop successful!\nAmount: ${amount} SOL\nRecipient: ${address}\nSignature: ${signature}`,
          },
        ],
      };
    } catch (err) {
      const error = err as Error;
      return {
        content: [
          {
            type: "text",
            text: `Airdrop failed: ${error.message}`,
          },
        ],
      };
    }
  }
);

// NEW: Anchor Test Suite Runner
server.tool(
  "runAnchorTests",
  "Execute TypeScript test suite for Anchor programs. Creates a temporary test file, compiles and runs it against your Anchor program.",
  {
    testCode: z.string().describe("TypeScript test code to execute"),
    programId: z
      .string()
      .optional()
      .describe("Program ID to test (optional, can be defined in test code)"),
    workingDirectory: z
      .string()
      .optional()
      .describe("Working directory path (defaults to current directory)"),
    testName: z
      .string()
      .optional()
      .default("anchor-test")
      .describe("Name for the test file"),
  },
  async ({ testCode, programId, workingDirectory, testName }) => {
    const tempDir = workingDirectory || process.cwd();
    const testFileName = `${testName}-${Date.now()}.ts`;
    const testFilePath = path.join(tempDir, testFileName);
    const outputFileName = testFileName.replace(".ts", ".js");
    const outputFilePath = path.join(tempDir, outputFileName);

    try {
      // Wrap test code with necessary imports and setup if not already present
      let finalTestCode = testCode;

      // Check if imports are missing and add them
      if (
        !testCode.includes("import * as anchor") &&
        !testCode.includes('from "@coral-xyz/anchor"')
      ) {
        finalTestCode = `
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";

${programId ? `const PROGRAM_ID = new PublicKey("${programId}");` : ""}

${testCode}
`;
      }

      // Write test file
      fs.writeFileSync(testFilePath, finalTestCode, "utf8");

      // Compile TypeScript to JavaScript
      const compileResult = ts.transpileModule(finalTestCode, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
          esModuleInterop: true,
          skipLibCheck: true,
          resolveJsonModule: true,
        },
      });

      fs.writeFileSync(outputFilePath, compileResult.outputText, "utf8");

      // Execute the compiled JavaScript
      const { stdout, stderr } = await execPromise(`node ${outputFilePath}`, {
        cwd: tempDir,
        env: {
          ...process.env,
          ANCHOR_PROVIDER_URL: SOLANA_RPC,
          ANCHOR_WALLET: process.env.HOME
            ? path.join(process.env.HOME, ".config/solana/id.json")
            : "",
        },
        timeout: 60000, // 60 second timeout
      });

      // Clean up temporary files
      try {
        fs.unlinkSync(testFilePath);
        fs.unlinkSync(outputFilePath);
      } catch (cleanupErr) {
        // Ignore cleanup errors
      }

      return {
        content: [
          {
            type: "text",
            text: `✅ Anchor Test Execution Completed

${programId ? `Program ID: ${programId}\n` : ""}
📊 Test Output:
${stdout || "(no stdout)"}

${stderr ? `⚠️ Warnings/Errors:\n${stderr}` : ""}

Test file: ${testFileName}
Working directory: ${tempDir}`,
          },
        ],
      };
    } catch (err) {
      const error = err as Error;

      // Clean up on error
      try {
        if (fs.existsSync(testFilePath)) fs.unlinkSync(testFilePath);
        if (fs.existsSync(outputFilePath)) fs.unlinkSync(outputFilePath);
      } catch (cleanupErr) {
        // Ignore cleanup errors
      }

      return {
        content: [
          {
            type: "text",
            text: `❌ Test Execution Failed

Error: ${error.message}

${(error as any).stdout ? `Output:\n${(error as any).stdout}\n` : ""}
${(error as any).stderr ? `Error Details:\n${(error as any).stderr}` : ""}

Make sure:
1. Anchor is installed (@coral-xyz/anchor)
2. Your program is deployed
3. Test code is valid TypeScript
4. Required dependencies are available`,
          },
        ],
      };
    }
  }
);


// DATA ANALYTICS
server.tool(
  "getRecentTransactions",
  "Fetch recent transactions for a Solana address on devnet",
  {
    address: z.string().describe("A valid Solana public key (base58 format)"),
    limit: z
      .number()
      .default(5)
      .describe("Number of recent transactions to fetch"),
  },
  async ({ address, limit }) => {
    try {
      const keyString = new PublicKey(address).toBase58();
      const pubkey = new PublicKey(keyString);

      console.error(`Fetching latest ${limit} txs for: ${keyString}`);

      const signatures = await connection.getSignaturesForAddress(pubkey, {
        limit,
      });

      if (signatures.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No transactions found for address: ${keyString}`,
            },
          ],
        };
      }

      // Format the transactions into readable text
      const formattedTxs = signatures
        .map((sig) => {
          const status = sig.err ? "Failed" : "Success";
          const timestamp = sig.blockTime
            ? new Date(sig.blockTime * 1000).toLocaleString()
            : "N/A";
          return `Signature: ${sig.signature}\nSlot: ${sig.slot}\nStatus: ${status}\nTimestamp: ${timestamp}\n`;
        })
        .join("\n");

      // Add instructions for Claude to create a visualization
      const instructionText = `\n\n📊 VISUALIZATION INSTRUCTION: Create an interactive React timeline artifact showing these transactions chronologically. Include the signature (truncated), status (success/failed with color coding), and timestamp for each transaction.`;

      return {
        content: [
          {
            type: "text",
            text: `✅ Recent Transactions for address: ${keyString}\n\n${formattedTxs}${instructionText}`,
          },
        ],
      };
    } catch (err) {
      const error = err as Error;
      return {
        content: [
          {
            type: "text",
            text: `❌ Failed to retrieve recent transactions for address: ${address}\n\nError: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "getTokenAccounts",
  "Fetch SPL token accounts held by a given Solana address",
  {
    address: z.string().describe("A valid Solana public key (base58 format)"),
  },
  async ({ address }) => {
    try {
      const keyString = new PublicKey(address).toBase58();
      const pubkey = new PublicKey(keyString);

      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        pubkey,
        {
          programId: new PublicKey(
            "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
          ),
        }
      );

      if (tokenAccounts.value.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No SPL token accounts found for address: ${keyString}`,
            },
          ],
        };
      }

      const formatted = tokenAccounts.value
        .map((acc) => {
          const info = acc.account.data.parsed.info;
          return `Token: ${info.mint}\nAmount: ${info.tokenAmount.uiAmountString}\n`;
        })
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text: `✅ SPL Token Accounts for address: ${keyString}\n\n${formatted}`,
          },
        ],
      };
    } catch (err) {
      const error = err as Error;
      return {
        content: [
          {
            type: "text",
            text: `❌ Failed to retrieve token accounts for address: ${address}\n\nError: ${error.message}`,
          },
        ],
      };
    }
  }
);

server.tool(
  "getTokenAndStakeAccounts",
  "Fetch SPL token accounts and staked SOL held by a given Solana address",
  {
    address: z.string().describe("A valid Solana public key (base58 format)"),
  },
  async ({ address }) => {
    try {
      const pubkey = new PublicKey(address);
      const keyString = pubkey.toBase58();

      // --- Fetch SPL Token Accounts ---
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(pubkey, {
        programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
      });

      const tokenText =
        tokenAccounts.value.length === 0
          ? "No SPL token accounts found."
          : tokenAccounts.value
              .map((acc) => {
                const parsedData = acc.account.data as ParsedAccountData;
                const info = parsedData.parsed.info;
                return `Token: ${info.mint}\nAmount: ${info.tokenAmount.uiAmountString}\n`;
              })
              .join("\n");

      // --- Fetch Staked SOL Accounts ---
      const stakeProgramId = new PublicKey("Stake11111111111111111111111111111111111111");
      const stakeAccounts = await connection.getParsedProgramAccounts(stakeProgramId, {
        filters: [
          {
            memcmp: {
              offset: 12, // owner offset
              bytes: keyString,
            },
          },
        ],
      });

      let totalStaked = 0;
      let stakeDetails = "";

      for (const acc of stakeAccounts) {
        // type guard: ensure parsed data
        const parsedAccount = acc.account.data as ParsedAccountData;
        if (parsedAccount?.program !== "stake") continue;

        const info = parsedAccount.parsed.info;
        const stakeData = info?.stake;
        const delegated = stakeData?.delegation?.stake ?? 0;

        totalStaked += delegated / 1e9; // convert lamports → SOL

        stakeDetails += `Validator: ${stakeData.delegation.voter}\nStaked: ${(delegated / 1e9).toFixed(6)} SOL\n\n`;
      }

      if (!stakeDetails) stakeDetails = "No active stake accounts found.";

      return {
        content: [
          {
            type: "text",
            text: `✅ Account Summary for: ${keyString}\n\n--- SPL Tokens ---\n${tokenText}\n\n--- Staked SOL ---\n${stakeDetails}Total Staked: ${totalStaked.toFixed(6)} SOL`,
          },
        ],
      };
    } catch (err) {
      const error = err as Error;
      return {
        content: [
          {
            type: "text",
            text: `❌ Failed to retrieve account info for address: ${address}\n\nError: ${error.message}`,
          },
        ],
      };
    }
  }
);



server.tool(
  "getTxsLast24Hours",
  "Analyze number of transactions for a Solana address in the past 24 hours",
  {
    address: z.string().describe("A valid Solana public key (base58 format)"),
    limit: z
      .number()
      .default(50)
      .describe("Number of recent transactions to fetch for analysis"),
  },
  async ({ address, limit }) => {
    try {
      const keyString = new PublicKey(address).toBase58();
      const pubkey = new PublicKey(keyString);

      const signatures = await connection.getSignaturesForAddress(pubkey, {
        limit,
      });

      if (signatures.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No transactions found for address: ${keyString}`,
            },
          ],
        };
      }

      const now = Math.floor(Date.now() / 1000);
      const oneDayAgo = now - 24 * 60 * 60;

      const recentTxs = signatures.filter(
        (sig) => sig.blockTime && sig.blockTime >= oneDayAgo
      );
      const successCount = recentTxs.filter((sig) => !sig.err).length;
      const failCount = recentTxs.length - successCount;

      return {
        content: [
          {
            type: "text",
            text:
              `📊 Transaction Activity (Last 24 Hours) for ${keyString}\n\n` +
              `Total Transactions: ${recentTxs.length}\n` +
              `✅ Successful: ${successCount}\n❌ Failed: ${failCount}` +
              `Display the data as a histogram of activity over time as an artifact`,
          },
        ],
      };
    } catch (err) {
      const error = err as Error;
      return {
        content: [
          {
            type: "text",
            text: `❌ Failed to fetch transactions for ${address}\n\nError: ${error.message}`,
          },
        ],
      };
    }
  }
);

server.tool(
  "detectAnomalies",
  "Detect potential anomalous activity for a Solana address in the past 24 hours",
  {
    address: z.string().describe("A valid Solana public key (base58 format)"),
    limit: z
      .number()
      .default(50)
      .describe("Number of recent transactions to fetch"),
    solThreshold: z
      .number()
      .default(10)
      .describe("Flag SOL transfers greater than this amount as large"),
  },
  async ({ address, limit, solThreshold }) => {
    try {
      const keyString = new PublicKey(address).toBase58();
      const pubkey = new PublicKey(keyString);

      const signatures = await connection.getSignaturesForAddress(pubkey, {
        limit,
      });

      if (signatures.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No transactions found for address: ${keyString}`,
            },
          ],
        };
      }

      const now = Math.floor(Date.now() / 1000);
      const oneDayAgo = now - 24 * 60 * 60;

      const recentTxs = signatures.filter(
        (sig) => sig.blockTime && sig.blockTime >= oneDayAgo
      );

      const anomalies: string[] = [];

      for (const sig of recentTxs) {
        if (sig.err) anomalies.push(`❌ Failed transaction: ${sig.signature}`);

        const tx = await connection.getParsedTransaction(
          sig.signature,
          "confirmed"
        );
        if (!tx) continue;

        tx.transaction.message.instructions.forEach((instr) => {
          // Check if instruction is parsed
          if ("program" in instr) {
            // Only ParsedInstruction has 'program'
            const info = (instr as any).parsed?.info;
            if (
              instr.program === "system" &&
              info?.lamports &&
              info.lamports / 1e9 > solThreshold
            ) {
              anomalies.push(
                `⚠️ Large SOL transfer: ${info.lamports / 1e9} SOL in tx ${
                  sig.signature
                }`
              );
            }
          }
        });
      }

      if (anomalies.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `✅ No anomalous activity detected for ${keyString} in the last 24 hours.`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text:
              `🚨 Anomalous Activity Detected for ${keyString} (last 24 hours):\n\n` +
              anomalies.join("\n"),
          },
        ],
      };
    } catch (err) {
      const error = err as Error;
      return {
        content: [
          {
            type: "text",
            text: `❌ Failed to detect anomalies for address: ${address}\n\nError: ${error.message}`,
          },
        ],
      };
    }
  }
);

server.tool(
  "convertCurrency",
  "Convert between SOL and USD",
  {
    address: z.string().describe("Wallet address (base58), used if amount is not provided"),
    amount: z
      .number()
      .optional()
      .describe(
        "Amount to convert. If not provided, defaults to the wallet's SOL balance (for SOL_TO_USD) or equivalent USD balance (for USD_TO_SOL)"
      ),
    direction: z
      .enum(["USD_TO_SOL", "SOL_TO_USD"])
      .describe("Conversion direction: USD → SOL or SOL → USD"),
  },
  async ({ address, amount, direction }) => {
    try {
      const pubkey = new PublicKey(address);
      const keyString = pubkey.toBase58();

      // 1️⃣ Fetch current SOL balance (in SOL)
      const lamports = await connection.getBalance(pubkey);
      const solBalance = lamports / 1e9;

      // 2️⃣ Fetch SOL price in USD
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
      );
      const data: { solana: { usd: number } } = await res.json();
      const solPrice = data.solana.usd;

      // 3️⃣ Determine numeric amount to convert
      let convertAmount: number;
      if (amount !== undefined) {
        convertAmount = amount;
      } else {
        convertAmount = direction === "SOL_TO_USD" ? solBalance : solBalance * solPrice;
      }

      // 4️⃣ Compute conversion
      let text: string;
      if (direction === "USD_TO_SOL") {
        const sol = convertAmount / solPrice;
        text = `💱 USD ${convertAmount.toFixed(2)} ≈ ${sol.toFixed(6)} SOL (1 SOL = $${solPrice})`;
      } else {
        const usd = convertAmount * solPrice;
        text = `💱 SOL ${convertAmount.toFixed(6)} ≈ $${usd.toFixed(2)} USD (1 SOL = $${solPrice})`;
      }

      return {
        content: [
          {
            type: "text",
            text,
          },
        ],
      };
    } catch (err) {
      const error = err as Error;
      return {
        content: [
          {
            type: "text",
            text: `❌ Failed to convert currency for wallet ${address}\nError: ${error.message}`,
          },
        ],
      };
    }
  }
);


server.tool(
  "createWallet",
  "Generate a temporary devnet wallet with airdropped SOL for demo transactions",
  {
    airdropAmount: z
      .number()
      .optional()
      .default(2)
      .describe("Amount of SOL to airdrop to the new wallet (default 2 SOL)"),
  },
  async ({ airdropAmount }) => {
    try {
      // Generate new keypair
      const keypair = Keypair.generate();
      const address = keypair.publicKey.toBase58();

      // Connect to devnet
      const devnetConnection = new Connection(clusterApiUrl("devnet"), "confirmed");

      // Request airdrop
      const sig = await devnetConnection.requestAirdrop(
        keypair.publicKey,
        airdropAmount * 1e9
      );

      // Confirm transaction
      await devnetConnection.confirmTransaction(sig, "confirmed");

      return {
        content: [
          {
            type: "text",
            text: `🆕 Temporary Devnet Wallet Created!\n\nAddress: ${address}\nAirdropped SOL: ${airdropAmount} SOL\nTransaction Signature: ${sig}`,
          },
        ],
      };
    } catch (err) {
      const error = err as Error;
      return {
        content: [
          {
            type: "text",
            text: `❌ Failed to create devnet wallet\nError: ${error.message}`,
          },
        ],
      };
    }
  }
);



async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Solana MCP Server with Anchor Test Suite running on stdio");
}

main().catch((err: unknown) => {
  const error = err as Error;
  console.error("Fatal error in main():", error.message);
  process.exit(1);
});
