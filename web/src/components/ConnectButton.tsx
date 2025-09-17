import { ensureConnected31337 } from "../utils/wallet";
import { Wallet } from "lucide-react";

export default function ConnectButton(){
  return (
    <button className="btn btn-ghost" onClick={ensureConnected31337}>
      <Wallet size={16}/> Connect MetaMask
    </button>
  );
}
