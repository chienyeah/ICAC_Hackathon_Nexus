export async function ensureConnected31337() {
  const eth = (window as any).ethereum;
  if (!eth) {
    alert("MetaMask not detected. Install MetaMask and refresh.");
    throw new Error("No ethereum provider");
  }

  // Request account access (triggers MetaMask prompt)
  await eth.request({ method: "eth_requestAccounts" });

  // Ensure we are on Hardhat (31337 = 0x7a69)
  const chainId: string = await eth.request({ method: "eth_chainId" });
  if (chainId !== "0x7a69") {
    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x7a69" }],
      });
    } catch (err: any) {
      // Chain not added
      if (err?.code === 4902) {
        await eth.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: "0x7a69",
            chainName: "Hardhat Localhost",
            rpcUrls: ["http://127.0.0.1:8545"],
            nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
          }],
        });
      } else {
        throw err;
      }
    }
  }
}
