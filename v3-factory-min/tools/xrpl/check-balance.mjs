import xrpl from "xrpl"

const {
  XRPL_ENDPOINT = "wss://s.altnet.rippletest.net:51233",
  ADDRESS,
  SEED
} = process.env

if (!ADDRESS && !SEED) {
  console.error("❌ Need ADDRESS or SEED in .env")
  process.exit(1)
}

async function main() {
  const client = new xrpl.Client(XRPL_ENDPOINT)
  await client.connect()

  // 주소가 없으면 SEED로부터 가져오기
  const addr = ADDRESS || xrpl.Wallet.fromSeed(SEED).classicAddress

  const res = await client.request({
    command: "account_info",
    account: addr,
    ledger_index: "validated"
  })

  const balanceDrops = res.result.account_data.Balance
  const balanceXrp = xrpl.dropsToXrp(balanceDrops)

  console.log("Account:", addr)
  console.log("Balance:", balanceXrp, "XRP")

  await client.disconnect()
}

main().catch((e) => {
  console.error("Error:", e)
  process.exit(1)
})
