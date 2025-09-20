import xrpl from "xrpl";

const {
  XRPL_ENDPOINT = "wss://xrplcluster.com",
  SEED,
  DEST,
  AMOUNT_XRP = "1",
} = process.env;

if (!SEED || !DEST) {
  console.error("Missing SEED or DEST in env.");
  process.exit(1);
}

const drops = xrpl.xrpToDrops(AMOUNT_XRP.toString());

async function main() {
  const client = new xrpl.Client(XRPL_ENDPOINT);
  await client.connect();

  const wallet = xrpl.Wallet.fromSeed(SEED);

  const prepared = await client.autofill({
    TransactionType: "Payment",
    Account: wallet.classicAddress,
    Destination: DEST,
    Amount: drops,
  });

  const signed = wallet.sign(prepared);
  const res = await client.submitAndWait(signed.tx_blob);

  console.log(JSON.stringify(res, null, 2));
  await client.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
