import xrpl from "xrpl";

// ─── Parse CLI args ───────────────────────────────
const [,, ...args] = process.argv;
const opts = {};
for (let i = 0; i < args.length; i += 2) {
  opts[args[i].replace(/^--/, "")] = args[i + 1];
}

const { seed, dest, amount } = opts;

async function main() {
  if (!seed || !dest || !amount) {
    console.error("Usage: node send-payment.mjs --seed <seed> --dest <address> --amount <xrp>");
    process.exit(1);
  }

  const client = new xrpl.Client(process.env.XRPL_ENDPOINT || "wss://s.altnet.rippletest.net:51233");
  await client.connect();

  const wallet = xrpl.Wallet.fromSeed(seed);

  const tx = {
    TransactionType: "Payment",
    Account: wallet.address,
    Destination: dest,
    Amount: xrpl.xrpToDrops(amount), // convert XRP to drops
  };

  const result = await client.submitAndWait(tx, { wallet });
  console.log("✅ Sent payment:", {
    hash: result.result.hash,
    explorer: `https://testnet.xrpl.org/transactions/${result.result.hash}`
  });

  await client.disconnect();
}

main();
