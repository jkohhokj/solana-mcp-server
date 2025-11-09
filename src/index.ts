import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { 
  Connection, 
  PublicKey, 
  Keypair,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import { z } from "zod";
import bs58 from 'bs58';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as ts from 'typescript';

const execPromise = promisify(exec);

const SOLANA_RPC = "https://api.devnet.solana.com";

// Create server instance
const server = new McpServer({
  name: "solana-rpc",
  version: "1.0.0",
});

// Initialize Solana connection
const connection = new Connection(SOLANA_RPC, 'confirmed');

// Register Solana tools
server.tool(
  "getSlot",
  "Get the current slot",
  {},
  async () => {
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
  }
);

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
    secretKey: z.string().describe("Base58 encoded secret key or array of bytes"),
  },
  async ({ secretKey }) => {
    try {
      let keypair: Keypair;
      try {
        const decoded = Uint8Array.from(secretKey.split(',').map(num => parseInt(num.trim())));
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
Account Program Owner: ${accountInfo?.owner?.toBase58() || 'N/A'}
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
    encoding: z.enum(['base58', 'base64', 'jsonParsed']).optional().describe("Data encoding format"),
  },
  async ({ address, encoding = 'base64' }) => {
    try {
      const publicKey = new PublicKey(address);
      const accountInfo = await connection.getAccountInfo(
        publicKey,
        'confirmed'
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
      if (encoding === 'base58') {
        formattedData = bs58.encode(accountInfo.data);
      } else if (encoding === 'base64') {
        formattedData = Buffer.from(accountInfo.data).toString('base64');
      } else {
        formattedData = Buffer.from(accountInfo.data).toString('base64');
      }

      return {
        content: [
          {
            type: "text",
            text: `Account Information for ${address}:
Lamports: ${accountInfo.lamports} (${accountInfo.lamports / LAMPORTS_PER_SOL} SOL)
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
    secretKey: z.string().describe("Your keypair's secret key (as comma-separated numbers or JSON array)"),
    toAddress: z.string().describe("Destination wallet address"),
    amount: z.number().positive().describe("Amount of SOL to send"),
  },
  async ({ secretKey, toAddress, amount }) => {
    try {
      let fromKeypair: Keypair;
      try {
        const decoded = Uint8Array.from(secretKey.split(',').map(num => parseInt(num.trim())));
        fromKeypair = Keypair.fromSecretKey(decoded);
      } catch {
        fromKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secretKey)));
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
    amount: z.number().min(0.1).max(5).describe("Amount of SOL to request (0.1-5)"),
  },
  async ({ address, amount }) => {
    try {
      const publicKey = new PublicKey(address);
      const lamports = amount * LAMPORTS_PER_SOL;
      
      const signature = await connection.requestAirdrop(publicKey, lamports);
      await connection.confirmTransaction(signature);

      return {
        content: [{
          type: "text",
          text: `Airdrop successful!\nAmount: ${amount} SOL\nRecipient: ${address}\nSignature: ${signature}`,
        }],
      };
    } catch (err) {
      const error = err as Error;
      return {
        content: [{
          type: "text",
          text: `Airdrop failed: ${error.message}`,
        }],
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
    programId: z.string().optional().describe("Program ID to test (optional, can be defined in test code)"),
    workingDirectory: z.string().optional().describe("Working directory path (defaults to current directory)"),
    testName: z.string().optional().default("anchor-test").describe("Name for the test file"),
  },
  async ({ testCode, programId, workingDirectory, testName }) => {
    const tempDir = workingDirectory || process.cwd();
    const testFileName = `${testName}-${Date.now()}.ts`;
    const testFilePath = path.join(tempDir, testFileName);
    const outputFileName = testFileName.replace('.ts', '.js');
    const outputFilePath = path.join(tempDir, outputFileName);

    try {
      // Wrap test code with necessary imports and setup if not already present
      let finalTestCode = testCode;
      
      // Check if imports are missing and add them
      if (!testCode.includes('import * as anchor') && !testCode.includes('from "@coral-xyz/anchor"')) {
        finalTestCode = `
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";

${programId ? `const PROGRAM_ID = new PublicKey("${programId}");` : ''}

${testCode}
`;
      }

      // Write test file
      fs.writeFileSync(testFilePath, finalTestCode, 'utf8');

      // Compile TypeScript to JavaScript
      const compileResult = ts.transpileModule(finalTestCode, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
          esModuleInterop: true,
          skipLibCheck: true,
          resolveJsonModule: true,
        }
      });

      fs.writeFileSync(outputFilePath, compileResult.outputText, 'utf8');

      // Execute the compiled JavaScript
      const { stdout, stderr } = await execPromise(`node ${outputFilePath}`, {
        cwd: tempDir,
        env: {
          ...process.env,
          ANCHOR_PROVIDER_URL: SOLANA_RPC,
          ANCHOR_WALLET: process.env.HOME ? path.join(process.env.HOME, '.config/solana/id.json') : '',
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

${programId ? `Program ID: ${programId}\n` : ''}
📊 Test Output:
${stdout || '(no stdout)'}

${stderr ? `⚠️ Warnings/Errors:\n${stderr}` : ''}

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

${(error as any).stdout ? `Output:\n${(error as any).stdout}\n` : ''}
${(error as any).stderr ? `Error Details:\n${(error as any).stderr}` : ''}

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

// NEW: Anchor Program Build Helper
server.tool(
  "buildAnchorProgram",
  "Build an Anchor program in the specified directory",
  {
    projectPath: z.string().describe("Path to the Anchor project directory"),
  },
  async ({ projectPath }) => {
    try {
      const { stdout, stderr } = await execPromise('anchor build', {
        cwd: projectPath,
        timeout: 300000, // 5 minute timeout for builds
      });

      return {
        content: [
          {
            type: "text",
            text: `✅ Anchor Build Completed

Project: ${projectPath}

📊 Build Output:
${stdout}

${stderr ? `⚠️ Warnings:\n${stderr}` : ''}`,
          },
        ],
      };
    } catch (err) {
      const error = err as Error;
      return {
        content: [
          {
            type: "text",
            text: `❌ Build Failed

Error: ${error.message}

${(error as any).stdout ? `Output:\n${(error as any).stdout}\n` : ''}
${(error as any).stderr ? `Error Details:\n${(error as any).stderr}` : ''}`,
          },
        ],
      };
    }
  }
);

// NEW: Deploy Anchor Program
server.tool(
  "deployAnchorProgram",
  "Deploy an Anchor program to devnet or specified cluster",
  {
    projectPath: z.string().describe("Path to the Anchor project directory"),
    cluster: z.enum(['devnet', 'testnet', 'mainnet-beta', 'localnet']).optional().default('devnet').describe("Cluster to deploy to"),
  },
  async ({ projectPath, cluster }) => {
    try {
      const { stdout, stderr } = await execPromise(`anchor deploy --provider.cluster ${cluster}`, {
        cwd: projectPath,
        timeout: 300000, // 5 minute timeout
      });

      // Try to extract program ID from output
      const programIdMatch = stdout.match(/Program Id: ([A-Za-z0-9]{32,44})/);
      const programId = programIdMatch ? programIdMatch[1] : null;

      return {
        content: [
          {
            type: "text",
            text: `✅ Deployment Completed

Project: ${projectPath}
Cluster: ${cluster}
${programId ? `Program ID: ${programId}\n` : ''}
📊 Deploy Output:
${stdout}

${stderr ? `⚠️ Warnings:\n${stderr}` : ''}
${programId ? `\n🔗 Explorer: https://explorer.solana.com/address/${programId}?cluster=${cluster}` : ''}`,
          },
        ],
      };
    } catch (err) {
      const error = err as Error;
      return {
        content: [
          {
            type: "text",
            text: `❌ Deployment Failed

Error: ${error.message}

${(error as any).stdout ? `Output:\n${(error as any).stdout}\n` : ''}
${(error as any).stderr ? `Error Details:\n${(error as any).stderr}` : ''}`,
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