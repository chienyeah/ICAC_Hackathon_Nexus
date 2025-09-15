import { http, createConfig } from "wagmi";
import { injected } from "wagmi/connectors";

export const config = createConfig({
  chains: [{ id: 31337, name: "Hardhat", nativeCurrency: { name:"ETH", symbol:"ETH", decimals:18 }, rpcUrls:{ default:{ http:["http://127.0.0.1:8545"]} } }],
  connectors: [injected()],
  transports: { [31337]: http("http://127.0.0.1:8545") }
});
