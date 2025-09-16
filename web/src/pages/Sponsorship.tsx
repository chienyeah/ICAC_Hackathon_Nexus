import axios from "axios";
import { useEffect, useState } from "react";
import type { Abi } from "viem";
import { createPublicClient, createWalletClient, custom, http } from "viem";
import { hardhat } from "viem/chains";
import { ADDR } from "../utils/env";
import { ensureConnected31337 } from "../utils/wallet";
import { formatTxError } from "../utils/errors";

const SPONSOR = ADDR.SPONSOR;
const publicClient = createPublicClient({ chain: hardhat, transport: http("http://127.0.0.1:8545") });
const ZERO_HASH = "0x".padEnd(66, "0") as `0x${string}`;
const H160 = /^0x[0-9a-fA-F]{40}$/;

const SPONSOR_ABI: Abi = [
  { type:"function", name:"registerDeal", stateMutability:"nonpayable",
    inputs:[
      {name:"club",type:"address"},
      {name:"amountWei",type:"uint256"},
      {name:"docSha256",type:"bytes32"},
      {name:"ipfsCid",type:"string"}
    ],
    outputs:[{name:"id",type:"uint256"}]
  }
];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve((fr.result as string).split(",")[1] || "");
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

export default function Sponsorship() {
  const [list, setList] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({ club: "", amountWei: "10000000000000000", ipfsCid: "" });

  async function refresh() {
    const { data } = await axios.get("http://localhost:4000/sponsors");
    setList(data);
  }

  async function register() {
    try {
      await ensureConnected31337();
      if (!H160.test(form.club)) throw new Error("Club must be a valid 0x address");
      const amount = BigInt(form.amountWei || "0");
      if (amount <= 0n) throw new Error("Amount must be greater than zero");

      let sha256: `0x${string}` = ZERO_HASH;
      if (file) {
        const base64 = await fileToBase64(file);
        const response = await axios.post("http://localhost:4000/hash-file", { base64 });
        if (!/^0x[0-9a-fA-F]{64}$/.test(response?.data?.sha256)) throw new Error("Bad hash from API");
        sha256 = response.data.sha256;
      }

      const [account] = await (window as any).ethereum.request({ method: "eth_requestAccounts" });
      const accountHex = account as `0x${string}`;
      const wallet = createWalletClient({
        transport: custom((window as any).ethereum),
        chain: hardhat,
        account: accountHex,
      });

      const args = [form.club as `0x${string}`, amount, sha256, form.ipfsCid] as const;

      await publicClient.simulateContract({
        abi: SPONSOR_ABI,
        address: SPONSOR,
        functionName: "registerDeal",
        account: accountHex,
        args,
      });

      const hash = await wallet.writeContract({
        abi: SPONSOR_ABI,
        address: SPONSOR,
        functionName: "registerDeal",
        args,
        account: accountHex,
        chain: hardhat,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      alert("✅ Sponsorship registered");
      setFile(null);
      await refresh();
    } catch (e: any) {
      console.error("register sponsorship error", e);
      alert(formatTxError(e));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div>
      <h2>Sponsorships</h2>
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
        <input placeholder="Club (0x...)" value={form.club} onChange={e=>setForm({...form, club: e.target.value})}/>
        <input placeholder="Amount (wei)" value={form.amountWei} onChange={e=>setForm({...form, amountWei: e.target.value})}/>
        <input placeholder="IPFS CID (optional)" value={form.ipfsCid} onChange={e=>setForm({...form, ipfsCid: e.target.value})}/>
        <input type="file" onChange={e=>setFile(e.target.files?.[0] || null)}/>
        <button onClick={register}>Register Deal</button>
      </div>

      <h3 style={{marginTop:24}}>Recent Deals</h3>
      <ul>
        {list.map(s=>(
          <li key={s.id}>
            #{s.id} Sponsor {s.sponsor} → Club {s.club} | Amount {s.amountWei} | SHA256 {s.docSha256?.slice(0,10)}… {s.ipfsCid && <a href={`https://ipfs.io/ipfs/${s.ipfsCid}`} target="_blank">doc</a>}
          </li>
        ))}
      </ul>
    </div>
  );
}
