import { hardhat } from "viem/chains";
import { createPublicClient, decodeEventLog, http } from "viem";
import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import type { Abi } from "viem";
import { createWalletClient, custom } from "viem";
import { ADDR } from "../utils/env";
import { ensureConnected31337 } from "../utils/wallet";
import TransferRegistryArtifact from "@artifacts/contracts/TransferRegistry.sol/TransferRegistry.json";
import RoleManagerArtifact from "@artifacts/contracts/RoleManager.sol/RoleManager.json";

const TRANSFER = ADDR.TRANSFER;
const ROLE_MANAGER = ADDR.ROLES;
const publicClient = createPublicClient({ chain: hardhat, transport: http("http://127.0.0.1:8545") });
const TRANSFER_ABI = TransferRegistryArtifact.abi as Abi;
const ROLE_MANAGER_ABI = RoleManagerArtifact.abi as Abi;
const TRANSFER_SUPPORTS_PAUSE = TRANSFER_ABI.some(
  (entry) => entry.type === "function" && (entry as any).name === "paused",
);

async function getPendingAwareNonce(address: `0x${string}`): Promise<number> {
  try {
    const pending = await publicClient.getTransactionCount({
      address,
      blockTag: "pending",
    });
    return Number(pending);
  } catch (err) {
    const latest = await publicClient.getTransactionCount({
      address,
      blockTag: "latest",
    });
    return Number(latest);
  }
}

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

  async function waitForIndexer(txHash: `0x${string}`): Promise<any> {
    const target = txHash.toLowerCase();
    const attempts = 12;
    for (let i = 0; i < attempts; i++) {
      try {
        const rows = await refresh();
        const match = rows.find((row: any) => typeof row?.txHash === "string" && row.txHash.toLowerCase() === target);
        if (match) {
          return match;
        }
      } catch (err: any) {
        if (i === attempts - 1) {
          throw new Error(`Transfer confirmed on-chain but failed to query the indexer: ${friendlyError(err)}`);
        }
      }
      if (i !== attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
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
      let isAdmin = false;
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
    setCheckingCircuit(true);
    let rolesPaused = false;
    let registryPaused = false;
    try {
      try {
        rolesPaused = Boolean(await publicClient.readContract({
          abi: ROLE_MANAGER_ABI,
          address: ROLE_MANAGER,
          functionName: "paused",
        }));
      } catch (err) {
        console.warn("roles pause probe failed", err);
      }
      if (TRANSFER_SUPPORTS_PAUSE) {
        try {
          registryPaused = Boolean(await publicClient.readContract({
            abi: TRANSFER_ABI,
            address: TRANSFER,
            functionName: "paused",
          }));
        } catch (err) {
          console.warn("transfer pause probe failed", err);
        }
      }
      return rolesPaused || registryPaused;
    } finally {
      setCircuitSource({ roles: rolesPaused, registry: registryPaused });
      setCircuitOpen(rolesPaused || registryPaused);
      setCheckingCircuit(false);
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
      const { request } = await publicClient.simulateContract({
        abi: ROLE_MANAGER_ABI,
        address: ROLE_MANAGER,
        functionName: "unpause",
        account: info.address,
      });
      const walletClient = createWalletClient({
        transport: custom((window as any).ethereum),
        chain: hardhat,
        account: info.address,
      });
      const initialNonce = await getPendingAwareNonce(info.address);
      let hash: `0x${string}`;
      try {
        hash = await walletClient.writeContract({ ...request, nonce: initialNonce });
      } catch (err: any) {
        const message = friendlyError(err).toLowerCase();
        if (message.includes("nonce")) {
          const retryNonce = await getPendingAwareNonce(info.address);
          hash = await walletClient.writeContract({ ...request, nonce: retryNonce });
        } else {
          throw err;
        }
      }
      await publicClient.waitForTransactionReceipt({ hash });
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

      const initialNonce = await getPendingAwareNonce(from);

      let hash: `0x${string}`;
      try {
        hash = await walletClient.writeContract({ ...request, nonce: initialNonce });
      } catch (err: any) {
        const message = friendlyError(err).toLowerCase();
        if (message.includes("nonce")) {
          const retryNonce = await getPendingAwareNonce(from);
          hash = await walletClient.writeContract({ ...request, nonce: retryNonce });
        } else {
          throw err;
        }
      }

      // ⬇️ wait here until mined (or throws on revert)
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        throw new Error("Transaction reverted on-chain. Check wallet role and try again.");
      }
      console.log("Tx mined:", receipt);

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
      if (/circuit breaker is open|Pausable: paused/i.test(message)) {
        setCircuitOpen(true);
        try {
          await refreshCircuit();
        } catch (refreshErr) {
          console.warn("refresh circuit after revert failed", refreshErr);
        }
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
    <div>
      <h2>Record Transfer</h2>
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:12}}>
        {circuitOpen && (
          <div
            style={{
              gridColumn: "1 / -1",
              background: "#fff2f0",
              color: "#7a1f1f",
              padding: 12,
              borderRadius: 6,
              lineHeight: 1.4,
            }}
          >
            <strong>Circuit breaker active.</strong>
            <div style={{ marginTop: 4 }}>
              Transfers are temporarily paused by administrators.
              {walletState.isAdmin ? " Use the button below to resume transfers." : " Only an administrator can resume transfers."}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              <button onClick={() => { void refreshCircuit(); }} disabled={checkingCircuit}>
                {checkingCircuit ? "Checking…" : "Refresh status"}
              </button>
              {walletState.isAdmin && (
                <button onClick={() => { void resumeTransfers(); }} disabled={resuming || checkingCircuit}>
                  {resuming ? "Resuming…" : "Resume transfers"}
                </button>
              )}
            </div>
            {(circuitSource.roles || circuitSource.registry) && (
              <div style={{ fontSize: 12, marginTop: 6, opacity: 0.85 }}>
                {circuitSource.roles && "Role manager pause is active."}
                {circuitSource.registry && `${circuitSource.roles ? " " : ""}Transfer registry pause is active.`}
              </div>
            )}
          </div>
        )}
        <input placeholder="Player ID" value={form.playerId} onChange={e=>setForm({...form, playerId: +e.target.value})}/>
        <input placeholder="To Club (0x...)" value={form.toClub} onChange={e=>setForm({...form, toClub: e.target.value})}/>
        <input placeholder="Fee (wei)" value={form.feeWei} onChange={e=>setForm({...form, feeWei: e.target.value})}/>
        <input placeholder="Agent (0x...)" value={form.agent} onChange={e=>setForm({...form, agent: e.target.value})}/>
        <input placeholder="Agent Fee (wei)" value={form.agentFeeWei} onChange={e=>setForm({...form, agentFeeWei: e.target.value})}/>
        <input placeholder="IPFS CID (optional)" value={form.ipfsCid} onChange={e=>setForm({...form, ipfsCid: e.target.value})}/>
        <input type="file" onChange={e=>setFile(e.target.files?.[0] || null)} />
        <button onClick={record} disabled={submitting || circuitOpen || checkingCircuit || resuming}>
          {circuitOpen ? "Transfers paused" : submitting ? "Submitting…" : "Submit"}
        </button>
      </div>

      <h3 style={{marginTop:24}}>Recent Transfers</h3>
      <ul>
        {list.map((t) => (
          <li key={t.id}>
            #{t.id} Player {t.playerId} {t.fromClub} → {t.toClub} | Fee {t.feeWei} | SHA256 {t.sha256 ? t.sha256.slice(0, 10) : ""}…
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