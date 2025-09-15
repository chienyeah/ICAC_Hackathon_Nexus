import axios from "axios";
import { useEffect, useState } from "react";
import type { Abi } from "viem";
import { createWalletClient, custom } from "viem";

const SPONSOR = import.meta.env.VITE_SPONSOR as `0x${string}`;

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

export default function Sponsorship(){
  const [list, setList] = useState<any[]>([]);
  const [file, setFile] = useState<File|null>(null);
  const [form, setForm] = useState({ club:"", amountWei:"10000000000000000", ipfsCid:"" });

  async function refresh(){ setList((await axios.get("http://localhost:4000/sponsors")).data); }

  async function register(){
    let sha256 = "0x";
    if(file){ sha256 = (await axios.post("http://localhost:4000/hash-file", { base64: await fileToBase64(file)})).data.sha256; }

    await (window as any).ethereum.request({ method:"eth_requestAccounts" });
    const wallet = createWalletClient({ transport: custom((window as any).ethereum) });

    await wallet.writeContract({
      abi: SPONSOR_ABI, address: SPONSOR, functionName: "registerDeal",
      args: [form.club as `0x${string}`, BigInt(form.amountWei), sha256 as `0x${string}`, form.ipfsCid]
    });
    setTimeout(refresh, 1500);
  }

  useEffect(()=>{ refresh(); }, []);

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
