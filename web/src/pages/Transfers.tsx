import { hardhat } from "viem/chains";
import { createPublicClient, http } from "viem";
import axios from "axios";
import { useEffect, useState } from "react";
import type { Abi } from "viem";
import { createWalletClient, custom } from "viem";
import { ADDR } from "../utils/env";
import { ensureConnected31337 } from "../utils/wallet";
import TransferRegistryArtifact from "@artifacts/contracts/TransferRegistry.sol/TransferRegistry.json";

const TRANSFER = ADDR.TRANSFER;
const publicClient = createPublicClient({ chain: hardhat, transport: http("http://127.0.0.1:8545") });
const TRANSFER_ABI = TransferRegistryArtifact.abi as Abi;

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

  async function record() {
    try {
      await ensureConnected31337();

      // validate inputs
      const addr = /^0x[0-9a-fA-F]{40}$/;
      if (!addr.test(form.toClub)) throw new Error("Invalid 'To Club' address");
      if (!addr.test(form.agent)) throw new Error("Invalid 'Agent' address");

      const playerId = BigInt(form.playerId);
      const feeWei = BigInt(form.feeWei || "0");
      const agentFeeWei = BigInt(form.agentFeeWei || "0");

      // optional file hash
      let sha256: `0x${string}` = "0x0000000000000000000000000000000000000000000000000000000000000000";
      if (file) {
        const b64 = await fileToBase64(file);
        const r = await axios.post("http://localhost:4000/hash-file", { base64: b64 });
        if (!/^0x[0-9a-fA-F]{64}$/.test(r?.data?.sha256)) throw new Error("Bad hash from API");
        sha256 = r.data.sha256;
      }

      const [account] = await (window as any).ethereum.request({ method: "eth_requestAccounts" });

      const { request } = await publicClient.simulateContract({
        abi: TRANSFER_ABI,
        address: TRANSFER,
        functionName: "recordTransfer",
        account: account as `0x${string}`,
        args: [
          playerId,
          form.toClub as `0x${string}`,
          feeWei,
          form.agent as `0x${string}`,
          agentFeeWei,
          sha256,
          form.ipfsCid || "",
        ],
      });

      const wallet = createWalletClient({
        transport: custom((window as any).ethereum),
        chain: hardhat,
        account: account as `0x${string}`,
      });

      const hash = await wallet.writeContract(request);

      // ⬇️ wait here until mined (or throws on revert)
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log("Tx mined:", receipt);

      alert("✅ Transfer confirmed in block " + receipt.blockNumber);
      setFile(null);
      await refresh(); // indexer should have picked the event by now
    } catch (e: any) {
      console.error(e);
      alert(e?.shortMessage || e?.details || e?.data?.message || e?.message || String(e));
    }
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
        {list.map((t) => (
          <li key={t.id}>
            #{t.id} Player {t.playerId} {t.fromClub} → {t.toClub} | Fee {t.feeWei} | SHA256 {t.sha256?.slice(0, 10)}…
            {" "}
            {t.ipfsCid && (
              <a href={`https://ipfs.io/ipfs/${t.ipfsCid}`} target="_blank" rel="noreferrer">
                doc
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
