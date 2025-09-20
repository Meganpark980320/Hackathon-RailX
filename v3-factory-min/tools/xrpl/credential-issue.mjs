import xrpl from "xrpl"

const XRPL_ENDPOINT = process.env.XRPL_ENDPOINT || "wss://s.altnet.rippletest.net:51233"
const SEED_ISSUER = process.env.SEED_ISSUER
const ADDRESS_SUBJECT = process.env.ADDRESS_SUBJECT

if (!SEED_ISSUER || !ADDRESS_SUBJECT) {
  console.error("❌ Need SEED_ISSUER and ADDRESS_SUBJECT in .env")
  process.exit(1)
}

async function main() {
  const client = new xrpl.Client(XRPL_ENDPOINT)
  await client.connect()

  const issuer = xrpl.Wallet.fromSeed(SEED_ISSUER)

  const tx = {
    TransactionType: "CredentialCreate",
    Account: issuer.classicAddress,
    Subject: ADDRESS_SUBJECT,
    CredentialType: Buffer.from("KYC_BASIC").toString("hex")
  }

  const prepared = await client.autofill(tx)
  const signed = issuer.sign(prepared)
  const res = await client.submitAndWait(signed.tx_blob)

  console.log("Result:", res.result.meta.TransactionResult)
  console.log("Tx Hash:", res.result.hash)

  const cred = res.result.meta.AffectedNodes
    .flatMap(n => Object.values(n))
    .find(m => m?.CreatedNode?.LedgerEntryType === "Credential")
  const credNode = res.result.meta.AffectedNodes
    .flatMap(n => Object.values(n))
    .find(m => m?.CreatedNode?.LedgerEntryType === "Credential")

  if (credNode) {
    console.log("CredentialID:", credNode.CreatedNode.LedgerIndex)
  } else {
    console.log("❗ CredentialID not found in meta, fetching via account_objects...")

    const objs = await client.request({
      command: "account_objects",
      account: issuer.classicAddress,
      type: "credential"
    })
    console.log(JSON.stringify(objs, null, 2))
  }

  await client.disconnect()
}

main()
