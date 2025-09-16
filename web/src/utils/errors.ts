export function formatTxError(err: any): string {
  const layers = [
    err?.shortMessage,
    err?.details,
    err?.error?.message,
    err?.data?.message,
    err?.cause?.shortMessage,
    err?.cause?.details,
    err?.cause?.data?.message,
    err?.cause?.cause?.message,
    err?.message,
  ];
  const first = layers.find((part) => typeof part === "string" && part.trim().length > 0);
  const fallback = typeof err === "string" ? err : JSON.stringify(err, null, 2);
  const base = first || fallback || "Transaction failed";

  if (/Nonce too high/i.test(base)) {
    return (
      base +
      "\n\nHint: reset the MetaMask account (Settings → Advanced → Reset Account) after restarting the local Hardhat chain."
    );
  }

  if (/execution reverted/i.test(base) && err?.error?.data?.message) {
    return err.error.data.message;
  }

  return base;
}
