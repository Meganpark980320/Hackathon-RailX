import fs from "fs"
import { ethers } from "ethers"
import { env } from "process"

const RPC = env.EVM_RPC
const PK  = env.EVM_PRIVATE_KEY
const TARGET = env.EVM_TARGET_CONTRACT

let ABI
if (env.EVM_TARGET_ABI_FILE) {
  ABI = JSON.parse(fs.readFileSync(env.EVM_TARGET_ABI_FILE, "utf8"))
} else {
  ABI = JSON.parse(env.EVM_TARGET_ABI || "[]")
}

if (!RPC || !PK || !TARGET) {
  throw new Error("EVM env not configured")
}

const provider = new ethers.JsonRpcProvider(RPC)
const wallet = new ethers.Wallet(PK, provider)
const contract = new ethers.Contract(TARGET, ABI, wallet)

export async function relaySwapAndSend(recipient, amount, extra = "0x") {
  const tx = await contract.swapAndSend(recipient, amount, extra)
  const receipt = await tx.wait()
  return receipt
}
