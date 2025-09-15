import { ethers } from "ethers";
import * as dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
dotenv.config();

const prisma = new PrismaClient();
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || "http://127.0.0.1:8545");

// addresses from deploy
const transferAddr = process.env.TRANSFER!;
const prizeAddr    = process.env.PRIZE!;
const sponsorAddr  = process.env.SPONSOR!;
const discAddr     = process.env.DISCIPLINARY!;

import transferAbi from "../artifacts/contracts/TransferRegistry.sol/TransferRegistry.json";
import prizeAbi from "../artifacts/contracts/PrizePool.sol/PrizePool.json";
import sponsorAbi from "../artifacts/contracts/SponsorshipRegistry.sol/SponsorshipRegistry.json";
import discAbi from "../artifacts/contracts/DisciplinaryRegistry.sol/DisciplinaryRegistry.json";

async function main() {
  const transfer = new ethers.Contract(transferAddr, transferAbi.abi, provider);
  const prize = new ethers.Contract(prizeAddr, prizeAbi.abi, provider);
  const spon = new ethers.Contract(sponsorAddr, sponsorAbi.abi, provider);
  const disc = new ethers.Contract(discAddr, discAbi.abi, provider);

  transfer.on("TransferRecorded", async (id, playerId, fromClub, toClub, feeWei, agent, agentFeeWei, docSha256, ipfsCid, ts, ev) => {
    await prisma.transfer.create({ data: {
      txHash: ev.log.transactionHash, id: Number(id), playerId: Number(playerId),
      fromClub, toClub, feeWei: feeWei.toString(), agent, agentFeeWei: agentFeeWei.toString(),
      docSha256: docSha256, ipfsCid, ts: Number(ts)
    }});
    console.log("Indexed transfer", id.toString());
  });

  prize.on("PrizeReleased", async (poolId, to, amount, ev) => {
    await prisma.prizeRelease.create({ data: {
      poolId: Number(poolId), toAddr: to, amount: amount.toString(),
      txHash: ev.log.transactionHash, ts: Math.floor(Date.now()/1000)
    }});
    console.log("Prize released", poolId.toString(), to);
  });

  spon.on("SponsorshipRegistered", async (id, sponsor, club, amountWei, docSha256, ipfsCid, ts, ev) => {
    await prisma.sponsorship.create({ data: {
      id: Number(id), sponsor, club, amountWei: amountWei.toString(),
      docSha256, ipfsCid, ts: Number(ts), 
    }});
    console.log("Indexed sponsorship", id.toString());
  });

  disc.on("SanctionLogged", async (id, subject, kind, reason, startDate, endDate, ts, ev) => {
    await prisma.sanction.create({ data: {
      id: Number(id), subject, kind, reason, startDate: Number(startDate), endDate: Number(endDate), ts: Number(ts)
    }});
    console.log("Indexed sanction", id.toString());
  });

  console.log("Indexer running...");
}

main();
