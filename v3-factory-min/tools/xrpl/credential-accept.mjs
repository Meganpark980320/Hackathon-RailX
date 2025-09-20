import xrpl from "xrpl"

const {
  XRPL_ENDPOINT = "wss://s.altnet.rippletest.net:51233",
  SEED,          // subject seed
  CREDENTIAL_ID  // 발급자가 준 CredentialID
} = process.env

if (!SEED || !CREDENTIAL_ID) {
  console.error("❌ Need SEED (subject) and CREDENTIAL_ID in .env")
  process.exit(1)
}

async function main() {
  const client = new xrpl.Client(XRPL_ENDPOINT)
  await client.connect()

  const subject = xrpl.Wallet.fromSeed(SEED)

  const tx = {
    TransactionType: "CredentialAccept",
    Account: subject.classicAddress,
    CredentialID: CREDENTIAL_ID
  }

  const prepared = await client.autofill(tx)
  const signed = subject.sign(prepared)
  const res = await client.submitAndWait(signed.tx_blob)

  console.log("Result:", res.result.meta.TransactionResult)
  console.log("Tx Hash:", res.result.hash)

  await client.disconnect()
}

main()
