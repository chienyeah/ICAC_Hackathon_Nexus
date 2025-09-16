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
const TRANSFER = requireEnv("TRANSFER");
const PRIZE = requireEnv("PRIZE");
const SPONSOR = requireEnv("SPONSOR");
const DISCIPLINARY = requireEnv("DISCIPLINARY");

const prisma = new PrismaClient();
const provider = new ethers.JsonRpcProvider(RPC);

const transfer = new ethers.Contract(TRANSFER, TransferRegistryArtifact.abi, provider);
const prize = new ethers.Contract(PRIZE, PrizePoolArtifact.abi, provider);
const sponsorship = new ethers.Contract(SPONSOR, SponsorshipRegistryArtifact.abi, provider);
const disciplinary = new ethers.Contract(DISCIPLINARY, DisciplinaryRegistryArtifact.abi, provider);

async function saveTransfer(event: ethers.EventLog, args: ethers.Result) {
  const block = await provider.getBlock(event.blockHash!);
  const ts = Number(block?.timestamp ?? Math.floor(Date.now() / 1000));
  await prisma.transfer.upsert({
    where: { id: Number(args.id) },
    create: {
      id: Number(args.id),
      txHash: event.transactionHash,
      playerId: Number(args.playerId),
      fromClub: String(args.fromClub),
      toClub: String(args.toClub),
      feeWei: String(args.feeWei),
      agent: String(args.agent),
      agentFeeWei: String(args.agentFeeWei),
      sha256: String(args.docSha256),
      ipfsCid: String(args.ipfsCid),
      ts,
    },
    update: {},
  });
  console.log(`Saved transfer #${args.id}`);
}

async function savePrizeRelease(event: ethers.EventLog, poolId: bigint, to: string, amount: bigint) {
  await prisma.prizeRelease.create({
    data: {
      poolId: Number(poolId),
      toAddr: to,
      amount: amount.toString(),
      txHash: event.transactionHash,
      ts: Math.floor(Date.now() / 1000),
    },
  });
  console.log(`Saved prize release pool=${poolId} to=${to}`);
}

async function saveSponsorship(event: ethers.EventLog, args: ethers.Result) {
  const timestamp = args.ts !== undefined ? Number(args.ts) : Math.floor(Date.now() / 1000);
  await prisma.sponsorship.upsert({
    where: { id: Number(args.id) },
    create: {
      id: Number(args.id),
      sponsor: String(args.sponsor),
      club: String(args.club),
      amountWei: String(args.amountWei),
      docSha256: String(args.docSha256),
      ipfsCid: String(args.ipfsCid),
      ts: timestamp,
    },
    update: {},
  });
  console.log(`Saved sponsorship #${args.id}`);
}

async function saveSanction(event: ethers.EventLog, args: ethers.Result) {
  const timestamp = args.ts !== undefined ? Number(args.ts) : Math.floor(Date.now() / 1000);
  await prisma.sanction.upsert({
    where: { id: Number(args.id) },
    create: {
      id: Number(args.id),
      subject: String(args.subject),
      kind: String(args.kind),
      reason: String(args.reason),
      startDate: Number(args.startDate),
      endDate: Number(args.endDate),
      ts: timestamp,
    },
    update: {
      // allow updating timestamps if the contract emits the same ID twice
      startDate: Number(args.startDate),
      endDate: Number(args.endDate),
      reason: String(args.reason),
    },
  });
  console.log(`Saved sanction #${args.id}`);
}

transfer.on("TransferRecorded", async (...params) => {
  const event = params[params.length - 1] as ethers.EventLog;
  const args = event.args as ethers.Result;
  try {
    await saveTransfer(event, args);
  } catch (err) {
    console.error("transfer index error", err);
  }
});

prize.on("PrizeReleased", async (poolId, to, amount, ...rest) => {
  const event = rest[rest.length - 1] as ethers.EventLog;
  try {
    await savePrizeRelease(event, poolId as bigint, to as string, amount as bigint);
  } catch (err) {
    console.error("prize index error", err);
  }
});

sponsorship.on("SponsorshipRegistered", async (...params) => {
  const event = params[params.length - 1] as ethers.EventLog;
  const args = event.args as ethers.Result;
  try {
    await saveSponsorship(event, args);
  } catch (err) {
    console.error("sponsorship index error", err);
  }
});

disciplinary.on("SanctionLogged", async (...params) => {
  const event = params[params.length - 1] as ethers.EventLog;
  const args = event.args as ethers.Result;
  try {
    await saveSanction(event, args);
  } catch (err) {
    console.error("disciplinary index error", err);
  }
});

console.log("Indexer listening on", RPC);
console.log("  transfer:", TRANSFER);
console.log("  prize:", PRIZE);
console.log("  sponsorship:", SPONSOR);
console.log("  disciplinary:", DISCIPLINARY);

process.on("SIGINT", async () => {
  console.log("Shutting down indexer...");
  transfer.removeAllListeners();
  prize.removeAllListeners();
  sponsorship.removeAllListeners();
  disciplinary.removeAllListeners();
  await prisma.$disconnect();
  process.exit(0);
});
