import { useState } from "react";
import Transfers from "./pages/Transfers.tsx";
import Prize from "./pages/Prize.tsx";
import Sponsorship from "./pages/Sponsorship.tsx";
import Disciplinary from "./pages/Disciplinary.tsx";

export default function App(){
  const [tab, setTab] = useState<"t"|"p"|"s"|"d">("t");
  return (
    <div style={{maxWidth: 1000, margin: "24px auto", padding: 16}}>
      <h1>SportChain Integrity</h1>
      <div style={{display:"flex", gap:8, margin:"16px 0"}}>
        <button onClick={()=>setTab("t")}>Transfers</button>
        <button onClick={()=>setTab("p")}>Prize</button>
        <button onClick={()=>setTab("s")}>Sponsorship</button>
        <button onClick={()=>setTab("d")}>Disciplinary</button>
      </div>
      {tab==="t" && <Transfers/>}
      {tab==="p" && <Prize/>}
      {tab==="s" && <Sponsorship/>}
      {tab==="d" && <Disciplinary/>}
      <p style={{opacity:.6, marginTop:24}}>Connect MetaMask to chain 31337 (Hardhat).</p>
    </div>
  );
}
