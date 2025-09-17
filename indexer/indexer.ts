import { ethers } from "ethers";
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import TransferRegistryArtifact from "../artifacts/contracts/TransferRegistry.sol/TransferRegistry.json";
import PrizePoolArtifact from "../artifacts/contracts/PrizePool.sol/PrizePool.json";
import SponsorshipRegistryArtifact from "../artifacts/contracts/SponsorshipRegistry.sol/SponsorshipRegistry.json";
import DisciplinaryRegistryArtifact from "../artifacts/contracts/DisciplinaryRegistry.sol/DisciplinaryRegistry.json";

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name} in environment`);
  }
  return value;
}

const RPC = process.env.RPC_URL || "http://127.0.0.1:8545";
const TRANSFER = process.env.TRANSFER || "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
const PRIZE = process.env.PRIZE || "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";
const SPONSOR = process.env.SPONSOR || "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";
const DISCIPLINARY = process.env.DISCIPLINARY || "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707";

const prisma = new PrismaClient();
const provider = new ethers.JsonRpcProvider(RPC);

const transfer = new ethers.Contract(TRANSFER, TransferRegistryArtifact.abi, provider);
const prize = new ethers.Contract(PRIZE, PrizePoolArtifact.abi, provider);
const sponsorship = new ethers.Contract(SPONSOR, SponsorshipRegistryArtifact.abi, provider);
const disciplinary = new ethers.Contract(DISCIPLINARY, DisciplinaryRegistryArtifact.abi, provider);

// Cursor for last processed block
let lastProcessedBlock = 0;

async function saveTransfer(eventLog: ethers.EventLog) {
  const args = eventLog.args;
  if (!args) return;

  const block = await provider.getBlock(eventLog.blockNumber);
  const ts = block ? Number(block.timestamp) : Math.floor(Date.now() / 1000);

  await prisma.transfer.upsert({
    where: { txHash: eventLog.transactionHash },
    create: {
      eventId: Number(args[0]),
      txHash: eventLog.transactionHash,
      playerId: Number(args[1]),
      fromClub: String(args[2]),
      toClub: String(args[3]),
      feeWei: String(args[4]),
      agent: String(args[5]),
      agentFeeWei: String(args[6]),
      sha256: String(args[7]),
      ipfsCid: String(args[8] || ''),
      ts,
    },
    update: {
      eventId: Number(args[0]),
      playerId: Number(args[1]),
      fromClub: String(args[2]),
      toClub: String(args[3]),
      feeWei: String(args[4]),
      agent: String(args[5]),
      agentFeeWei: String(args[6]),
      sha256: String(args[7]),
      ipfsCid: String(args[8] || ''),
      ts,
    },
  });
  console.log(`Saved transfer eventId=${args[0]} tx=${eventLog.transactionHash}`);
}

async function savePrizeRelease(eventLog: ethers.EventLog) {
  const args = eventLog.args;
  if (!args) return;

  const block = await provider.getBlock(eventLog.blockNumber);
  const ts = block ? Number(block.timestamp) : Math.floor(Date.now() / 1000);

  await prisma.prizeRelease.create({
    data: {
      poolId: Number(args[0]),
      toAddr: String(args[1]),
      amount: String(args[2]),
      txHash: eventLog.transactionHash,
      ts,
    },
  });
  console.log(`Saved prize release pool=${args[0]} to=${args[1]}`);
}

async function saveSponsorship(eventLog: ethers.EventLog) {
  const args = eventLog.args;
  if (!args) return;

  const timestamp = args[6] ? Number(args[6]) : Math.floor(Date.now() / 1000);

  await prisma.sponsorship.upsert({
    where: { id: Number(args[0]) },
    create: {
      id: Number(args[0]),
      sponsor: String(args[1]),
      club: String(args[2]),
      amountWei: String(args[3]),
      docSha256: String(args[4]),
      ipfsCid: String(args[5]),
      ts: timestamp,
    },
    update: {},
  });
  console.log(`Saved sponsorship #${args[0]}`);
}

async function saveSanction(eventLog: ethers.EventLog) {
  const args = eventLog.args;
  if (!args) return;

  const timestamp = args[6] ? Number(args[6]) : Math.floor(Date.now() / 1000);

  await prisma.sanction.upsert({
    where: { id: Number(args[0]) },
    create: {
      id: Number(args[0]),
      subject: String(args[1]),
      kind: String(args[2]),
      reason: String(args[3]),
      startDate: Number(args[4]),
      endDate: Number(args[5]),
      ts: timestamp,
    },
    update: {
      startDate: Number(args[4]),
      endDate: Number(args[5]),
      reason: String(args[3]),
    },
  });
  console.log(`Saved sanction #${args[0]}`);
}

async function processEvents() {
  try {
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = lastProcessedBlock + 1;
    if (fromBlock > currentBlock) {
      // Uncomment for verbose: console.log(`No new blocks (current: ${currentBlock}, from: ${fromBlock})`);
      return; // nothing new
    }
    const toBlock = currentBlock;

    console.log(`Processing blocks ${fromBlock} to ${toBlock} (cursor: ${lastProcessedBlock})`);

    // Get transfer events
    const transferLogs = await provider.getLogs({
      address: TRANSFER,
      fromBlock,
      toBlock,
      topics: [ethers.id("TransferRecorded(uint256,uint256,address,address,uint256,address,uint256,bytes32,string)")]
    });
    if (transferLogs.length > 0) {
      console.log(`Found ${transferLogs.length} TransferRecorded logs in blocks ${fromBlock}-${toBlock}`);
    }

    for (const log of transferLogs) {
      try {
        const parsedLog = transfer.interface.parseLog(log);
        if (parsedLog && parsedLog.name === "TransferRecorded") {
          await saveTransfer({
            ...log,
            args: parsedLog.args,
            eventName: parsedLog.name
          } as any);
        }
      } catch (err) {
        console.error("Transfer event parse error:", err);
      }
    }

    // Get prize events
    const prizeLogs = await provider.getLogs({
      address: PRIZE,
      fromBlock,
      toBlock,
      topics: [ethers.id("PrizeReleased(uint256,address,uint256)")]
    });

    for (const log of prizeLogs) {
      try {
        const parsedLog = prize.interface.parseLog(log);
        if (parsedLog && parsedLog.name === "PrizeReleased") {
          await savePrizeRelease({
            ...log,
            args: parsedLog.args,
            eventName: parsedLog.name
          } as any);
        }
      } catch (err) {
        console.error("Prize event parse error:", err);
      }
    }

    // Get sponsorship events
    const sponsorLogs = await provider.getLogs({
      address: SPONSOR,
      fromBlock,
      toBlock,
      topics: [ethers.id("SponsorshipRegistered(uint256,address,address,uint256,bytes32,string,uint64)")]
    });

    for (const log of sponsorLogs) {
      try {
        const parsedLog = sponsorship.interface.parseLog(log);
        if (parsedLog && parsedLog.name === "SponsorshipRegistered") {
          await saveSponsorship({
            ...log,
            args: parsedLog.args,
            eventName: parsedLog.name
          } as any);
        }
      } catch (err) {
        console.error("Sponsorship event parse error:", err);
      }
    }

    // Get disciplinary events
    const disciplinaryLogs = await provider.getLogs({
      address: DISCIPLINARY,
      fromBlock,
      toBlock,
      topics: [ethers.id("SanctionLogged(uint256,address,string,string,uint64,uint64,uint64)")]
    });

    for (const log of disciplinaryLogs) {
      try {
        const parsedLog = disciplinary.interface.parseLog(log);
        if (parsedLog && parsedLog.name === "SanctionLogged") {
          await saveSanction({
            ...log,
            args: parsedLog.args,
            eventName: parsedLog.name
          } as any);
        }
      } catch (err) {
        console.error("Disciplinary event parse error:", err);
      }
    }

    lastProcessedBlock = toBlock;
  } catch (err) {
    console.error("Event processing error:", err);
  }
}

// Process past events first and set cursor
async function processPastEvents() {
  try {
    // Get the latest transfer from database to determine cursor
    const latestTransferFromDb = await prisma.transfer.findFirst({
      orderBy: { id: 'desc' }
    });
    
    if (latestTransferFromDb) {
      // Get the block number from the latest transaction hash
      try {
        const receipt = await provider.getTransactionReceipt(latestTransferFromDb.txHash);
        if (receipt) {
          lastProcessedBlock = receipt.blockNumber;
          console.log(`Resuming indexer from block ${lastProcessedBlock} (latest DB transfer #${latestTransferFromDb.id})`);
          return;
        }
      } catch (err) {
        console.warn("Failed to get receipt for latest transfer, falling back to chain scan");
      }
    }
    
    // Fallback: scan the chain for past events
    const events = await transfer.queryFilter("TransferRecorded", 0);
    console.log(`Found ${events.length} past TransferRecorded events`);
    
    let maxBlock = 0;
    for (const event of events) {
      try {
        const eventLog = event as ethers.EventLog;
        await saveTransfer(eventLog);
        if (eventLog.blockNumber > maxBlock) {
          maxBlock = eventLog.blockNumber;
        }
      } catch (err) {
        console.error("Past transfer index error", err);
      }
    }
    
    if (maxBlock > 0) {
      lastProcessedBlock = maxBlock;
      console.log(`Indexer cursor set to block ${lastProcessedBlock} from chain scan`);
    }
  } catch (err) {
    console.warn("Failed to initialize indexer cursor:", err);
  }
}

console.log("Indexer listening on", RPC);
console.log("  transfer:", TRANSFER);
console.log("  prize:", PRIZE);
console.log("  sponsorship:", SPONSOR);
console.log("  disciplinary:", DISCIPLINARY);

// Process past events first
processPastEvents();

// Poll for new events every 2 seconds
setInterval(processEvents, 2000);

process.on("SIGINT", async () => {
  console.log("Shutting down indexer...");
  await prisma.$disconnect();
  process.exit(0);
});
