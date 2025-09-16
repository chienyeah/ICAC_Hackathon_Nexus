import { ensureConnected31337 } from "../utils/wallet";

export default function ConnectButton(){
  return <button onClick={ensureConnected31337}>🔌 Connect MetaMask</button>;
}
