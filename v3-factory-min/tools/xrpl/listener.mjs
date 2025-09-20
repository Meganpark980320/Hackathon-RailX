import express from "express"
import bodyParser from "body-parser"
import xrpl from "xrpl"
import fs from "fs"
import { relaySwapAndSend } from "./evm-relay.mjs"

const {
  XRPL_ENDPOINT,
  ADDRESS_ISSUER,
  API_AUTH_TOKEN,
  PORT = 3001,
} = process.env

const app = express()
app.use(bodyParser.json())

// ─── Credential 체크 함수 ───────────────────────────────
async function hasCredential(xrplAddress) {
  const client = new xrpl.Client(XRPL_ENDPOINT)
  await client.connect()
  const resp = await client.request({
    command: "account_objects",
    account: ADDRESS_ISSUER,
    type: "credential",
  })
  await client.disconnect()

  return resp.result.account_objects.some(
    (obj) => obj.Subject === xrplAddress
  )
}

// ─── REST Endpoint: /trigger ─────────────────────────────
app.post("/trigger", async (req, res) => {
  try {
    // 인증 토큰 확인
    const auth = req.headers.authorization
    if (!auth || auth !== `Bearer ${API_AUTH_TOKEN}`) {
      return res.status(401).json({ error: "Unauthorized" })
    }

    const { xrplAddress, recipient, amount } = req.body
    if (!xrplAddress || !recipient || !amount) {
      return res.status(400).json({ error: "Missing params" })
    }

    // XRPL Credential 검증
    const ok = await hasCredential(xrplAddress)
    if (!ok) {
      return res.status(403).json({ error: "Credential not found" })
    }

    // EVM Swap+Send 실행
    const txHash = await relaySwapAndSend(recipient, amount)

    return res.json({
      status: "success",
      txHash,
    })
  } catch (err) {
    console.error("❌ Trigger error:", err)
    return res.status(500).json({ error: err.message })
  }
})

// ─── 서버 시작 ─────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Listener running on port ${PORT}`)
  console.log(`POST http://localhost:${PORT}/trigger`)
})
