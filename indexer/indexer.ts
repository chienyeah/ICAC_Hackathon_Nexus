import { ethers } from "ethers";
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
dotenv.config();

const RPC = process.env.RPC_URL || "http://127.0.0.1:8545";
const TRANSFER = process.env.TRANSFER!;
const prisma = new PrismaClient();
const provider = new ethers.JsonRpcProvider(RPC);

const TRANSFER_EVENT =
  "event TransferRecorded(uint256 indexed id,uint256 indexed playerId,address indexed fromClub,address toClub,uint256 feeWei,address agent,uint256 agentFeeWei,bytes32 docSha256,string ipfsCid)";
const iface = new ethers.Interface([TRANSFER_EVENT]);

async function handleLog(log: ethers.Log) {
  try {
    const parsed = iface.parseLog(log)!;
    const a = parsed.args as any;

    // Get block timestamp (seconds)
    const block = await provider.getBlock(log.blockHash!);
    const ts = Number(block?.timestamp ?? Math.floor(Date.now() / 1000));

    await prisma.transfer.upsert({
      where: { id: Number(a.id) },
      create: {
        id: Number(a.id),
        txHash: log.transactionHash,
        playerId: Number(a.playerId),
        fromClub: String(a.fromClub),
        toClub: String(a.toClub),
        feeWei: String(a.feeWei),
        agent: String(a.agent),
        agentFeeWei: String(a.agentFeeWei),
        docSha256: String(a.docSha256),
        ipfsCid: String(a.ipfsCid),
        ts,                                 // <— add this
      },
      update: {}, // immutable
    });

    console.log(`Saved transfer #${a.id} ts=${ts} tx=${log.transactionHash}`);
  } catch (e) {
    console.error("indexer save error:", e);
  }
}

console.log("Listening for TransferRecorded on", TRANSFER);
provider.on(
  { address: TRANSFER, topics: [iface.getEvent("TransferRecorded")!.topicHash] },
  handleLog
);
