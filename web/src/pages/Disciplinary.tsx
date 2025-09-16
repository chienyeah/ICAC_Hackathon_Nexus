import axios from "axios";
import { useEffect, useState } from "react";
import type { Abi } from "viem";
import { createPublicClient, createWalletClient, custom, http } from "viem";
import { hardhat } from "viem/chains";
import { ADDR } from "../utils/env";
import { ensureConnected31337 } from "../utils/wallet";

const DISCIPLINARY = ADDR.DISCIPLINARY;
const publicClient = createPublicClient({ chain: hardhat, transport: http("http://127.0.0.1:8545") });
const H160 = /^0x[0-9a-fA-F]{40}$/;

const DISCIPLINARY_ABI: Abi = [
  { type:"function", name:"logSanction", stateMutability:"nonpayable",
    inputs:[
      {name:"subject",type:"address"},
      {name:"kind",type:"string"},
      {name:"reason",type:"string"},
      {name:"startDate",type:"uint64"},
      {name:"endDate",type:"uint64"}
    ], outputs:[] }
];

export default function Disciplinary() {
  const [list, setList] = useState<any[]>([]);
  const [form, setForm] = useState({ subject: "", kind: "Suspension", reason: "", start: "", end: "" });

  async function refresh() {
    const { data } = await axios.get("http://localhost:4000/sanctions");
    setList(data);
  }

  async function log() {
    try {
      await ensureConnected31337();
      if (!H160.test(form.subject)) throw new Error("Subject must be a valid 0x address");
      if (!form.start || !form.end) throw new Error("Start and end dates are required");
      const start = Math.floor(new Date(form.start).getTime() / 1000);
      const end = Math.floor(new Date(form.end).getTime() / 1000);
      if (Number.isNaN(start) || Number.isNaN(end)) throw new Error("Invalid dates");
      if (end < start) throw new Error("End date must be after start date");

      const [account] = await (window as any).ethereum.request({ method: "eth_requestAccounts" });
      const accountHex = account as `0x${string}`;
      const wallet = createWalletClient({
        transport: custom((window as any).ethereum),
        chain: hardhat,
        account: accountHex,
      });

      const { request } = await publicClient.simulateContract({
        abi: DISCIPLINARY_ABI,
        address: DISCIPLINARY,
        functionName: "logSanction",
        account: accountHex,
        args: [form.subject as `0x${string}`, form.kind, form.reason, BigInt(start), BigInt(end)],
      });

      const hash = await wallet.writeContract(request);
      await publicClient.waitForTransactionReceipt({ hash });
      alert("✅ Sanction logged");
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
      <h2>Disciplinary Log</h2>
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
        <input placeholder="Subject (0x...)" value={form.subject} onChange={e=>setForm({...form, subject: e.target.value})}/>
        <input placeholder="Kind" value={form.kind} onChange={e=>setForm({...form, kind: e.target.value})}/>
        <input placeholder="Reason" value={form.reason} onChange={e=>setForm({...form, reason: e.target.value})}/>
        <input type="date" value={form.start} onChange={e=>setForm({...form, start: e.target.value})}/>
        <input type="date" value={form.end} onChange={e=>setForm({...form, end: e.target.value})}/>
        <button onClick={log}>Log Sanction</button>
      </div>

      <h3 style={{marginTop:24}}>Recent Sanctions</h3>
      <ul>
        {list.map(s=>(
          <li key={s.id}>
            #{s.id} {s.kind} for {s.subject} | {s.reason} | {new Date(s.startDate*1000).toLocaleDateString()} → {new Date(s.endDate*1000).toLocaleDateString()}
          </li>
        ))}
      </ul>
    </div>
  );
}
