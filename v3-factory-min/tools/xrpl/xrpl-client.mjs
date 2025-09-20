import xrpl from "xrpl"
import { env } from "process"

const XRPL_ENDPOINT = env.XRPL_ENDPOINT || "wss://s.altnet.rippletest.net:51233"

export async function checkCredentialExists(issuerAddr, subjectAddr, credentialTypeHex = null) {
  const client = new xrpl.Client(XRPL_ENDPOINT)
  await client.connect()
  try {
    // issuer의 account_objects에서 credential entries 찾기
    const resp = await client.request({
      command: "account_objects",
      account: issuerAddr,
      type: "credential"
    })
    const items = resp.result.account_objects || []
    // optional: filter by CredentialType hex if provided
    const match = items.find(it => {
      const goodSubject = it.Subject === subjectAddr
      const goodType = credentialTypeHex ? (it.CredentialType === credentialTypeHex.toUpperCase()) : true
      return goodSubject && goodType
    })
    // match 존재 → Credential 객체(대기 또는 활성화된 상태로 ledger에 존재)
    return match || null
  } finally {
    await client.disconnect()
  }
}
