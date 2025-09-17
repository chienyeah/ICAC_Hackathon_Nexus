import { hardhat } from "viem/chains";
import { createPublicClient, decodeEventLog, http, custom } from "viem";
import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import type { Abi } from "viem";
import { createWalletClient } from "viem";
import { ADDR } from "../utils/env";
import { ensureConnected31337 } from "../utils/wallet";
import TransferRegistryArtifact from "@artifacts/contracts/TransferRegistry.sol/TransferRegistry.json";
import RoleManagerArtifact from "@artifacts/contracts/RoleManager.sol/RoleManager.json";
import { Plus, RefreshCw, ShieldAlert, Play, Upload, FileText, CircleCheck, Trash2 } from "lucide-react";

const TRANSFER = ADDR.TRANSFER;
const ROLE_MANAGER = ADDR.ROLES;
const ADMIN_HINT = (import.meta as any).env?.VITE_ADMIN as `0x${string}` | undefined;
// Use direct HTTP RPC for reads to avoid MetaMask provider rate limits/circuit breaker
const publicClient = createPublicClient({
  chain: hardhat,
  transport: http("http://127.0.0.1:8545"),
});
const TRANSFER_ABI = TransferRegistryArtifact.abi as Abi;
const ROLE_MANAGER_ABI = RoleManagerArtifact.abi as Abi;
const TRANSFER_SUPPORTS_PAUSE = TRANSFER_ABI.some(
  (entry) => entry.type === "function" && (entry as any).name === "paused",
);

// Note: Let the wallet manage nonces to avoid provider-level circuit breakers.

// Helper: read a File as base64 (browser-safe, no Buffer needed)
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve((fr.result as string).split(",")[1] || "");
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

function friendlyError(err: any): string {
  return err?.shortMessage || err?.details || err?.data?.message || err?.message || String(err);
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
  const [circuitOpen, setCircuitOpen] = useState(false);
  const [circuitSource, setCircuitSource] = useState({ roles: false, registry: false });
  const [checkingCircuit, setCheckingCircuit] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [walletState, setWalletState] = useState<{ address: `0x${string}` | null; isAdmin: boolean }>({
    address: null,
    isAdmin: false,
  });

  const refresh = useCallback(async (): Promise<any[]> => {
    const response = await axios.get("http://localhost:4000/transfers");
    const data = Array.isArray(response.data) ? response.data : [];
    setList(data);
    return data;
  }, []);

  async function clearTransfers() {
    await axios.post("http://localhost:4000/transfers/clear");
    await refresh();
  }

  async function waitForIndexer(txHash: `0x${string}`): Promise<any> {
    const target = txHash.toLowerCase();
    console.log(`🔍 Waiting for indexer to process tx: ${target}`);
    const attempts = 12;
    for (let i = 0; i < attempts; i++) {
      try {
        const rows = await refresh();
        console.log(`📋 Attempt ${i + 1}/${attempts}: Found ${rows.length} transfers in API`);
        const match = rows.find((row: any) => typeof row?.txHash === "string" && row.txHash.toLowerCase() === target);
        if (match) {
          console.log(`✅ Found matching transfer #${match.id} in API`);
          return match;
        }
        console.log(`⏳ Transfer ${target} not found yet, waiting...`);
      } catch (err: any) {
        console.warn(`❌ API call failed on attempt ${i + 1}:`, err);
        if (i === attempts - 1) {
          throw new Error(`Transfer confirmed on-chain but failed to query the indexer: ${friendlyError(err)}`);
        }
      }
      if (i !== attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }
    throw new Error(
      "Transfer confirmed on-chain but the indexer hasn't stored it yet. It may still be syncing—please wait a few seconds and refresh the Transfers list.",
    );
  }

  const refreshWalletStatus = useCallback(async (): Promise<{ address: `0x${string}` | null; isAdmin: boolean }> => {
    const eth = (window as any).ethereum;
    let info: { address: `0x${string}` | null; isAdmin: boolean } = { address: null, isAdmin: false };
    if (!eth) {
      setWalletState(info);
      return info;
    }
    try {
      const accounts = (await eth.request({ method: "eth_accounts" })) as string[] | undefined;
      const address = (accounts?.[0] ?? null) as `0x${string}` | null;
      if (!address) {
        setWalletState(info);
        return info;
      }
      // Prefer env hint to avoid provider reads when possible
      let isAdmin = Boolean(ADMIN_HINT && ADMIN_HINT.toLowerCase() === address.toLowerCase());
      if (!isAdmin) {
        try {
          const adminRole = (await publicClient.readContract({
            abi: ROLE_MANAGER_ABI,
            address: ROLE_MANAGER,
            functionName: "ADMIN_ROLE",
          })) as `0x${string}`;
          isAdmin = (await publicClient.readContract({
            abi: ROLE_MANAGER_ABI,
            address: ROLE_MANAGER,
            functionName: "hasRole",
            args: [adminRole, address],
          })) as boolean;
        } catch (err) {
          console.warn("admin role lookup failed", err);
        }
      }

      // Fallbacks: check DEFAULT_ADMIN_ROLE on TransferRegistry (0x00..00) and optional VITE_ADMIN hint
      if (!isAdmin) {
        try {
          const DEFAULT_ADMIN_ROLE = ("0x" + "00".repeat(32)) as `0x${string}`;
          const hasDefaultAdmin = (await publicClient.readContract({
            abi: TRANSFER_ABI,
            address: TRANSFER,
            functionName: "hasRole",
            args: [DEFAULT_ADMIN_ROLE, address],
          })) as boolean;
          if (hasDefaultAdmin) isAdmin = true;
        } catch (err) {
          // ignore
        }
      }

      if (!isAdmin && ADMIN_HINT && typeof ADMIN_HINT === "string") {
        if (ADMIN_HINT.toLowerCase() === address.toLowerCase()) isAdmin = true;
      }
      info = { address, isAdmin };
      setWalletState(info);
      return info;
    } catch (err) {
      console.warn("wallet status check failed", err);
      setWalletState(info);
      return info;
    }
  }, []);

  async function refreshCircuit(): Promise<boolean> {
    console.log("--- refreshCircuit called ---");
    setCheckingCircuit(true);
    let rolesPaused = false;
    let registryPaused = false;
    try {
      try {
        console.log("Checking RoleManager pause status...");
        const rolesPausedResult = await publicClient.readContract({
          abi: ROLE_MANAGER_ABI,
          address: ROLE_MANAGER,
          functionName: "paused",
        });
        rolesPaused = Boolean(rolesPausedResult);
        console.log("RoleManager.paused() returned:", rolesPausedResult, "->", rolesPaused);
      } catch (err: any) {
        console.warn("roles pause probe failed", err);
      }

      try {
        console.log("Checking TransferRegistry pause status...");
        const registryPausedResult = await publicClient.readContract({
          abi: TRANSFER_ABI,
          address: TRANSFER,
          functionName: "paused",
        });
        registryPaused = Boolean(registryPausedResult);
        console.log("TransferRegistry.paused() returned:", registryPausedResult, "->", registryPaused);
      } catch (err: any) {
        console.warn("transfer pause probe failed", err);
      }

      const isPaused = rolesPaused || registryPaused;
      console.log("Final pause state (isPaused):", isPaused);
      return isPaused;
    } finally {
      const finalState = rolesPaused || registryPaused;
      console.log("Setting circuitSource:", { roles: rolesPaused, registry: registryPaused });
      setCircuitSource({ roles: rolesPaused, registry: registryPaused });
      console.log("Setting circuitOpen:", finalState);
      setCircuitOpen(finalState);
      setCheckingCircuit(false);
      console.log("--- refreshCircuit finished ---");
    }
  }

  async function resumeTransfers() {
    try {
      setResuming(true);
      await ensureConnected31337();
      const info = await refreshWalletStatus();
      if (!info.address) {
        throw new Error("Connect a wallet with the admin role to resume transfers");
      }
      if (!info.isAdmin) {
        throw new Error("Only an administrator can close the circuit breaker");
      }
      const walletClient = createWalletClient({
        transport: custom((window as any).ethereum),
        chain: hardhat,
        account: info.address,
      });
      const [rolesPaused, registryPaused] = await Promise.all([
        publicClient.readContract({ abi: ROLE_MANAGER_ABI, address: ROLE_MANAGER, functionName: "paused" }).catch(() => false),
        TRANSFER_SUPPORTS_PAUSE
          ? publicClient.readContract({ abi: TRANSFER_ABI, address: TRANSFER, functionName: "paused" }).catch(() => false)
          : Promise.resolve(false),
      ]);

      const txHashes: `0x${string}`[] = [];

      if (rolesPaused) {
        const { request } = await publicClient.simulateContract({
          abi: ROLE_MANAGER_ABI,
          address: ROLE_MANAGER,
          functionName: "unpause",
          account: info.address,
        });
        txHashes.push(await walletClient.writeContract(request));
      }

      if (registryPaused) {
        const { request } = await publicClient.simulateContract({
          abi: TRANSFER_ABI,
          address: TRANSFER,
          functionName: "unpause",
          account: info.address,
        });
        txHashes.push(await walletClient.writeContract(request));
      }

      for (const h of txHashes) {
        await publicClient.waitForTransactionReceipt({ hash: h });
      }
      await refreshCircuit();
      alert("✅ Transfers resumed. You can submit new transfers now.");
    } catch (err) {
      console.error(err);
      alert(friendlyError(err));
    } finally {
      setResuming(false);
    }
  }

  async function record() {
    let lastWalletInfo: { address: `0x${string}` | null; isAdmin: boolean } | null = null;
    try {
      setSubmitting(true);
      await ensureConnected31337();

      const walletInfo = await refreshWalletStatus();
      lastWalletInfo = walletInfo;
      const from = walletInfo.address;
      if (!from) {
        throw new Error("Unable to determine connected wallet address");
      }

      const stillOpen = await refreshCircuit();
      if (stillOpen) {
        // Force circuit state to be consistent for UI
        setCircuitOpen(true);
        if (walletInfo.isAdmin) {
          throw new Error("Transfers are paused. Close the circuit breaker with the Resume button before submitting.");
        }
        throw new Error("Transfers are currently paused by administrators. Please try again after the circuit breaker is closed.");
      }

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

      const clubRole = (await publicClient.readContract({
        abi: TRANSFER_ABI,
        address: TRANSFER,
        functionName: "CLUB_ROLE",
      })) as `0x${string}`;

      const hasClubRole = (await publicClient.readContract({
        abi: TRANSFER_ABI,
        address: TRANSFER,
        functionName: "hasRole",
        args: [clubRole, from],
      })) as boolean;

      if (!hasClubRole) {
        throw new Error("Connected wallet is not authorised to record transfers");
      }

      const { request } = await publicClient.simulateContract({
        abi: TRANSFER_ABI,
        address: TRANSFER,
        functionName: "recordTransfer",
        account: from,
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

      const walletClient = createWalletClient({
        transport: custom((window as any).ethereum),
        chain: hardhat,
        account: from,
      });

      const hash = await walletClient.writeContract(request);
      console.log(`🚀 Transaction submitted: ${hash}`);

      // ⬇️ wait here until mined (or throws on revert)
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        throw new Error("Transaction reverted on-chain. Check wallet role and try again.");
      }
      console.log(`⛏️ Tx mined in block ${receipt.blockNumber}: ${hash}`);

      let eventId: bigint | null = null;
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== TRANSFER.toLowerCase()) continue;
        try {
          const decoded = decodeEventLog({ abi: TRANSFER_ABI, data: log.data, topics: log.topics });
          if (decoded.eventName !== "TransferRecorded") continue;
          const args = decoded.args;
          if (Array.isArray(args)) {
            const maybeId = args[0];
            if (typeof maybeId === "bigint") {
              eventId = maybeId;
              break;
            }
          } else if (args && typeof args === "object" && "id" in args) {
            const maybeId = (args as Record<string, unknown>).id;
            if (typeof maybeId === "bigint") {
              eventId = maybeId;
              break;
            }
          }
        } catch (err) {
          console.warn("Failed to decode log", err);
        }
      }
      if (eventId === null) {
        console.warn("Transfer receipt did not include a TransferRecorded log", receipt.logs);
      }

      const indexed = await waitForIndexer(hash);
      await refresh();

      setFile(null);
      const confirmedId = indexed?.id ?? (eventId !== null ? Number(eventId) : "");
      const label = confirmedId !== "" ? `#${confirmedId} ` : "";
      alert(`✅ Transfer ${label}confirmed in block ${receipt.blockNumber}`);
      await refreshCircuit();
    } catch (e: any) {
      console.error(e);
      const message = friendlyError(e);
      let paused = false;
      try {
        paused = await refreshCircuit();
      } catch {}
      if (paused || /Pausable: paused/i.test(message)) {
        setCircuitOpen(true);
        const info = lastWalletInfo ?? walletState;
        const guidance = info.isAdmin
          ? "Use the Resume transfers button to close the circuit breaker before submitting."
          : "Please contact an administrator to resume transfers before submitting.";
        alert(`Transfers are paused. ${guidance}`);
        return;
      }
      alert(message);
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => { void refreshWalletStatus(); }, [refreshWalletStatus]);

  useEffect(() => {
    const eth = (window as any).ethereum;
    if (!eth?.on) {
      return;
    }
    const handler = () => {
      void refreshWalletStatus();
      void refreshCircuit();
    };
    eth.on("accountsChanged", handler);
    eth.on("chainChanged", handler);
    return () => {
      eth.removeListener?.("accountsChanged", handler);
      eth.removeListener?.("chainChanged", handler);
    };
  }, [refreshWalletStatus]);

  useEffect(() => {
    void refresh();
    void refreshCircuit();
  }, [refresh]);

  return (
    <div className="container" style={{paddingTop: 12}}>
      <div className="card card-dark" style={{overflow: "hidden"}}>
        <div className="card-body">
          <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12}}>
            <div>
              <div className="title">Record Transfer</div>
              <div className="subtitle">Create a new player transfer with optional document hash</div>
            </div>
            <button className="btn btn-ghost" onClick={() => { void refresh(); }}><RefreshCw size={16}/> Refresh</button>
          </div>

          <div className="grid grid-responsive" style={{width:"100%"}}>
        {circuitOpen && (
          <div className="card" style={{ gridColumn: "1 / -1", borderColor: "#fecaca", background: "#fff1f2" }}>
            <div className="card-body" style={{color: "#7a1f1f"}}>
              <div style={{display:"flex", alignItems:"center", gap:8, fontWeight:700}}><ShieldAlert size={18}/> Circuit breaker active</div>
              <div className="subtitle">
                Transfers are temporarily paused by administrators.
                {walletState.isAdmin ? " Use the button below to resume transfers." : " Only an administrator can resume transfers."}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                <button className="btn btn-ghost" onClick={() => { void refreshCircuit(); }} disabled={checkingCircuit}>
                  <RefreshCw size={16}/>{checkingCircuit ? "Checking…" : "Refresh status"}
                </button>
                {walletState.isAdmin && (
                  <button className="btn" onClick={() => { void resumeTransfers(); }} disabled={resuming || checkingCircuit}>
                    <Play size={16}/>{resuming ? "Resuming…" : "Resume transfers"}
                  </button>
                )}
              </div>
              {(circuitSource.roles || circuitSource.registry) && (
                <div className="muted" style={{ marginTop: 6 }}>
                  {circuitSource.roles && "Role manager pause is active."}
                  {circuitSource.registry && `${circuitSource.roles ? " " : ""}Transfer registry pause is active.`}
                </div>
              )}
            </div>
          </div>
        )}
        <input className="input" placeholder="Player ID" value={form.playerId} onChange={e=>setForm({...form, playerId: +e.target.value})}/>
        <input className="input" placeholder="To Club (0x...)" value={form.toClub} onChange={e=>setForm({...form, toClub: e.target.value})}/>
        <input className="input" placeholder="Fee (wei)" value={form.feeWei} onChange={e=>setForm({...form, feeWei: e.target.value})}/>
        <input className="input" placeholder="Agent (0x...)" value={form.agent} onChange={e=>setForm({...form, agent: e.target.value})}/>
        <input className="input" placeholder="Agent Fee (wei)" value={form.agentFeeWei} onChange={e=>setForm({...form, agentFeeWei: e.target.value})}/>
        <input className="input" placeholder="IPFS CID (optional)" value={form.ipfsCid} onChange={e=>setForm({...form, ipfsCid: e.target.value})}/>
        <div style={{display:"flex", gap:8, alignItems:"center", flexWrap:'wrap'}}>
          <label className="btn btn-ghost" style={{position:'relative', overflow:'hidden'}}>
            <input type="file" onChange={e=>setFile(e.target.files?.[0] || null)} style={{position:'absolute', inset:0, opacity:0, cursor:'pointer'}} />
            <FileText size={14}/> Choose file
          </label>
          <span className="muted" style={{whiteSpace:"nowrap"}}>{file ? file.name : "No file chosen (optional)"}</span>
        </div>
        <button className="btn" onClick={record} disabled={submitting || circuitOpen || checkingCircuit || resuming}>
          <Plus size={16}/>{circuitOpen ? "Transfers paused" : submitting ? "Submitting…" : "Submit"}
        </button>
          </div>
        </div>
      </div>

      <div className="card card-full" style={{marginTop:24}}>
        <div className="card-body">
          <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8}}>
            <div className="title">Recent Transfers</div>
            <button className="btn btn-ghost" onClick={() => { void clearTransfers(); }}><Trash2 size={16}/> Clear recent transfers</button>
          </div>
          <ul>
            {list.map((t) => (
              <li key={t.id} style={{display:"flex", alignItems:"center", gap:8, padding:"12px 0", borderBottom:"1px solid #e5e7eb", flexWrap:'wrap'}}>
                <CircleCheck size={16} color="#10b981"/>
                <span style={{fontWeight:600}}>#{t.id}</span>
                <span>Player {t.playerId}</span>
                <span style={{color:'#6b7280'}}>{t.fromClub}</span>
                <span>→</span>
                <span style={{color:'#6b7280'}}>{t.toClub}</span>
                <span>| Fee {t.feeWei}</span>
                <span className="muted">| SHA256 {t.sha256 ? t.sha256.slice(0, 10) : ""}…</span>
                {t.ipfsCid && (
                  <a href={`https://ipfs.io/ipfs/${t.ipfsCid}`} target="_blank" rel="noreferrer" style={{marginLeft:'auto'}}>
                    <Upload size={16}/> doc
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}