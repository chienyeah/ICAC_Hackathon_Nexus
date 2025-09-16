import axios from "axios";
import { useEffect, useState } from "react";
import type { Abi } from "viem";
import { createPublicClient, createWalletClient, custom, http, parseEther } from "viem";
import { hardhat } from "viem/chains";
import { ADDR } from "../utils/env";
import { ensureConnected31337 } from "../utils/wallet";

const PRIZE = ADDR.PRIZE;
const TOKEN = ADDR.TOKEN;
const publicClient = createPublicClient({ chain: hardhat, transport: http("http://127.0.0.1:8545") });

const TOKEN_ABI: Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
];
const PRIZE_ABI: Abi = [
  {
    type: "function",
    name: "createPool",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "uint256", name: "id" }],
  },
  {
    type: "function",
    name: "verifyResults",
    stateMutability: "nonpayable",
    inputs: [{ name: "poolId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "release",
    stateMutability: "nonpayable",
    inputs: [
      { name: "poolId", type: "uint256" },
      { name: "winners", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
    ],
    outputs: [],
  },
];

const H160 = /^0x[0-9a-fA-F]{40}$/;

export default function Prize() {
  const [poolId, setPoolId] = useState<number>(1);
  const [amountSct, setAmountSct] = useState("1000");
  const [to1, setTo1] = useState("");
  const [amt1, setAmt1] = useState("300");
  const [to2, setTo2] = useState("");
  const [amt2, setAmt2] = useState("700");
  const [releases, setReleases] = useState<any[]>([]);

  async function refresh() {
    const { data } = await axios.get("http://localhost:4000/prizes");
    setReleases(data);
  }

  async function approveAndCreate() {
    try {
      await ensureConnected31337();
      const deposit = parseEther(amountSct || "0");
      if (deposit <= 0n) throw new Error("Deposit must be greater than zero");

      const [account] = await (window as any).ethereum.request({ method: "eth_requestAccounts" });
      const accountHex = account as `0x${string}`;
      const wallet = createWalletClient({
        transport: custom((window as any).ethereum),
        chain: hardhat,
        account: accountHex,
      });

      const approveHash = await wallet.writeContract({
        abi: TOKEN_ABI,
        address: TOKEN,
        functionName: "approve",
        args: [PRIZE, deposit],
        chain: hardhat,
        account: accountHex,
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      const { request } = await publicClient.simulateContract({
        abi: PRIZE_ABI,
        address: PRIZE,
        functionName: "createPool",
        account: accountHex,
        args: [TOKEN, deposit],
      });
      const hash = await wallet.writeContract(request);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      alert("✅ Prize pool created in block " + receipt.blockNumber);
      await refresh();
    } catch (e: any) {
      console.error(e);
      alert(e?.shortMessage || e?.details || e?.data?.message || e?.message || String(e));
    }
  }

  async function verifyResults() {
    try {
      await ensureConnected31337();
      const [account] = await (window as any).ethereum.request({ method: "eth_requestAccounts" });
      const accountHex = account as `0x${string}`;
      const wallet = createWalletClient({
        transport: custom((window as any).ethereum),
        chain: hardhat,
        account: accountHex,
      });

      const { request } = await publicClient.simulateContract({
        abi: PRIZE_ABI,
        address: PRIZE,
        functionName: "verifyResults",
        account: accountHex,
        args: [BigInt(poolId)],
      });
      const hash = await wallet.writeContract(request);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      alert("✅ Results verified in block " + receipt.blockNumber);
    } catch (e: any) {
      console.error(e);
      alert(e?.shortMessage || e?.details || e?.data?.message || e?.message || String(e));
    }
  }

  async function release() {
    try {
      await ensureConnected31337();
      if (!H160.test(to1) || !H160.test(to2)) throw new Error("Winner addresses must be valid 0x strings");
      const amountOne = parseEther(amt1 || "0");
      const amountTwo = parseEther(amt2 || "0");
      if (amountOne <= 0n || amountTwo <= 0n) throw new Error("Amounts must be greater than zero");

      const [account] = await (window as any).ethereum.request({ method: "eth_requestAccounts" });
      const accountHex = account as `0x${string}`;
      const wallet = createWalletClient({
        transport: custom((window as any).ethereum),
        chain: hardhat,
        account: accountHex,
      });

      const winners = [to1 as `0x${string}`, to2 as `0x${string}`];
      const amounts = [amountOne, amountTwo];

      const { request } = await publicClient.simulateContract({
        abi: PRIZE_ABI,
        address: PRIZE,
        functionName: "release",
        account: accountHex,
        args: [BigInt(poolId), winners, amounts],
      });
      const hash = await wallet.writeContract(request);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      alert("✅ Prize released in block " + receipt.blockNumber);
      await refresh();
    } catch (e: any) {
      console.error(e);
      alert(e?.shortMessage || e?.details || e?.data?.message || e?.message || String(e));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div>
      <h2>Prize Pools</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <input placeholder="Deposit (SCT)" value={amountSct} onChange={(e) => setAmountSct(e.target.value)} />
        <button onClick={approveAndCreate}>Approve &amp; Create Pool</button>

        <input placeholder="Pool ID" value={poolId} onChange={(e) => setPoolId(+e.target.value)} />
        <button onClick={verifyResults}>Verify Results</button>

        <input placeholder="Winner 1 (0x...)" value={to1} onChange={(e) => setTo1(e.target.value)} />
        <input placeholder="Amount 1 (SCT)" value={amt1} onChange={(e) => setAmt1(e.target.value)} />
        <input placeholder="Winner 2 (0x...)" value={to2} onChange={(e) => setTo2(e.target.value)} />
        <input placeholder="Amount 2 (SCT)" value={amt2} onChange={(e) => setAmt2(e.target.value)} />
        <button onClick={release}>Release</button>
      </div>

      <h3 style={{ marginTop: 24 }}>Released Payouts</h3>
      <ul>
        {releases.map((r) => (
          <li key={r.id}>
            Pool {r.poolId} → {r.toAddr} : {r.amount}
          </li>
        ))}
      </ul>
    </div>
  );
}
