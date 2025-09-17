import { useState } from "react";
import ConnectButton from "./components/ConnectButton.tsx";
import Transfers from "./pages/Transfers.tsx";
import Prize from "./pages/Prize.tsx";
import Sponsorship from "./pages/Sponsorship.tsx";
import Disciplinary from "./pages/Disciplinary.tsx";

export default function App() {
  const [tab, setTab] = useState<"t" | "p" | "s" | "d">("t");

  return (
    <div className="container" style={{paddingLeft: 12, paddingRight: 12}}>
      {/* Header with title and visible Connect button */}
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, paddingLeft:4, paddingRight:4}}>
        <h1 style={{ margin: 0 }}>SportChain Integrity</h1>
        <ConnectButton />
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, margin: "16px 0" }}>
        <button className="btn btn-ghost" onClick={() => setTab("t")}>Transfers</button>
        <button className="btn btn-ghost" onClick={() => setTab("p")}>Prize</button>
        <button className="btn btn-ghost" onClick={() => setTab("s")}>Sponsorship</button>
        <button className="btn btn-ghost" onClick={() => setTab("d")}>Disciplinary</button>
      </div>

      {/* Pages */}
      {tab === "t" && <Transfers />}
      {tab === "p" && <Prize />}
      {tab === "s" && <Sponsorship />}
      {tab === "d" && <Disciplinary />}

      <p className="muted" style={{ marginTop: 24 }}>
        Connect MetaMask to chain 31337 (Hardhat).
      </p>
    </div>
  );
}
