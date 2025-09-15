import axios from "axios";
import { useEffect, useState } from "react";
import type { Abi, ContractFunctionParameters } from "viem";
import { createWalletClient, custom } from "viem";

const TRANSFER = import.meta.env.VITE_TRANSFER as `0x${string}`;

// Minimal ABI (only what we call)
const TRANSFER_ABI: Abi = [
  {
    type: "function",
    name: "recordTransfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "playerId", type: "uint256" },
      { name: "toClub", type: "address" },
      { name: "feeWei", type: "uint256" },
      { name: "agent", type: "address" },
      { name: "agentFeeWei", type: "uint256" },
      { name: "docSha256", type: "bytes32" },
      { name: "ipfsCid", type: "string" }
    ],
    outputs: [{ name: "id", type: "uint256" }]
  }
];

// Helper: read a File as base64 (browser-safe, no Buffer needed)
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve((fr.result as string).split(",")[1] || "");
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

export default function Transfers(){
  const [list, setList] = useState<any[]>([]);
  const [file, setFile] = useState<File|null>(null);
  const [form, setForm] = useState({
    playerId: 10,
    toClub: "",
    feeWei: "10000000000000000",
    agent: "",
    agentFeeWei: "0",
    ipfsCid: ""
  });

  async function refresh() {
    const { data } = await axios.get("http://localhost:4000/transfers");
    setList(data);
  }

  async function record(){
    let sha256 = "0x";
    if(file){
      const b64 = await fileToBase64(file);
      const r = await axios.post("http://localhost:4000/hash-file", { base64: b64 });
      sha256 = r.data.sha256; // "0x...."
    }

    await (window as any).ethereum.request({ method:"eth_requestAccounts" });
    const wallet = createWalletClient({ transport: custom((window as any).ethereum) });

    const data: ContractFunctionParameters = {
      abi: TRANSFER_ABI,
      address: TRANSFER,
      functionName: "recordTransfer",
      args: [
        BigInt(form.playerId),
        form.toClub as `0x${string}`,
        BigInt(form.feeWei),
        form.agent as `0x${string}`,
        BigInt(form.agentFeeWei),
        sha256 as `0x${string}`,
        form.ipfsCid
      ]
    };

    await wallet.writeContract(data);
    setTimeout(refresh, 1500);
  }

  useEffect(()=>{ refresh(); }, []);

  return (
    <div>
      <h2>Record Transfer</h2>
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
        <input placeholder="Player ID" value={form.playerId} onChange={e=>setForm({...form, playerId: +e.target.value})}/>
        <input placeholder="To Club (0x...)" value={form.toClub} onChange={e=>setForm({...form, toClub: e.target.value})}/>
        <input placeholder="Fee (wei)" value={form.feeWei} onChange={e=>setForm({...form, feeWei: e.target.value})}/>
        <input placeholder="Agent (0x...)" value={form.agent} onChange={e=>setForm({...form, agent: e.target.value})}/>
        <input placeholder="Agent Fee (wei)" value={form.agentFeeWei} onChange={e=>setForm({...form, agentFeeWei: e.target.value})}/>
        <input placeholder="IPFS CID (optional)" value={form.ipfsCid} onChange={e=>setForm({...form, ipfsCid: e.target.value})}/>
        <input type="file" onChange={e=>setFile(e.target.files?.[0] || null)} />
        <button onClick={record}>Submit</button>
      </div>

      <h3 style={{marginTop:24}}>Recent Transfers</h3>
      <ul>
        {list.map(t=>(
          <li key={t.id}>
            #{t.id} Player {t.playerId} {t.fromClub} → {t.toClub} | Fee {t.feeWei} | SHA256 {t.docSha256?.slice(0,10)}… {t.ipfsCid && <a href={`https://ipfs.io/ipfs/${t.ipfsCid}`} target="_blank">doc</a>}
          </li>
        ))}
      </ul>
    </div>
  );
}
