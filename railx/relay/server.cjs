// server.cjs
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { ethers } = require("ethers");

const app = express();
app.use(cors({ origin: ["http://localhost:3000"], methods: ["GET","POST","OPTIONS"], allowedHeaders: ["Content-Type","Authorization"] }));
app.use(express.json());

// ── 필수 .env ─────────────────────────────────────
// RPC_URL: XRPL EVM RPC (예: https://rpc.testnet.xrplevm.org)
// PRIVATE_KEY: 리레이어 EOA 프라이빗키 (스왑 수수료/가스 지불자)
// (선택) BATCH_ADDRESS: 온체인 BatchRouter가 있을 때만 사용
const RPC_URL = process.env.RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const BATCH_ADDRESS = process.env.BATCH_ADDRESS || ""; // 없으면 단일 call만 직접 전송

if (!RPC_URL || !PRIVATE_KEY) {
  console.error("Missing RPC_URL or PRIVATE_KEY in env");
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// (선택) BatchRouter ABI 예시 (targets+data 배열 지원 버전)
const batchAbi = [
  "function batch(address[] calldata targets, bytes[] calldata data) payable returns (bytes[] memory results)"
];

app.get("/health", (_req, res) => res.status(200).send("ok"));

app.post("/batch", async (req, res) => {
  try {
    const { xrplAddress, evmSettlement, calls, atomic } = req.body;

    // 0) 최소 유효성 체크
    if (!Array.isArray(calls) || calls.length === 0) {
      return res.status(400).json({ error: "calls[] required" });
    }
    for (const c of calls) {
      if (!c?.to || !c?.data) return res.status(400).json({ error: "each call needs {to,data}" });
    }

    // 1) (선택) Credential 검사 자리에 너희 로직 연결
    if (!xrplAddress || !/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(String(xrplAddress))) {
      return res.status(400).json({ error: "invalid XRPL r-address" });
    }
    // TODO: 실제 CredentialVerifier 확인 / 미통과시 return res.status(403).json({error:"credential denied"})

    // 2) 실행 경로 분기
    if (atomic && BATCH_ADDRESS) {
      // ── 온체인 BatchRouter가 있을 때: 한 방에 원자적으로 실행 ──
      const targets = calls.map(c => c.to);
      const datas   = calls.map(c => c.data);
      const batch = new ethers.Contract(BATCH_ADDRESS, batchAbi, wallet);

      const tx = await batch.batch(targets, datas, { value: 0 }); // value 필요하면 넣기
      const rc = await tx.wait();
      return res.json({ ok: true, txHash: tx.hash, block: rc.blockNumber });
    } else if (calls.length === 1) {
      // ── 배치 컨트랙트 없고 단일 콜이면: 직접 forward ──
      const { to, data } = calls[0];

      // NOTE: 이 경로는 "원자적 멀티콜"은 아니지만, 지금 네 payload는 1개 call이니 OK
      const tx = await wallet.sendTransaction({ to, data, value: 0 }); // 라우터가 nonpayable이니까 value=0
      const rc = await tx.wait();
      return res.json({ ok: true, txHash: tx.hash, block: rc.blockNumber });
    } else {
      // ── 여러 콜인데 배치 컨트랙트가 없으면 원자성 불가 ──
      return res.status(400).json({ error: "Atomic batch requested but BATCH_ADDRESS missing" });
    }
  } catch (e) {
    console.error("batch error:", e);
    // ethers v6 에러 메시지 정리
    return res.status(500).json({ error: e?.reason || e?.shortMessage || e?.message || String(e) });
  }
});

const PORT = process.env.PORT || 3005; // Next와 충돌 피하려면 3005 추천
app.listen(PORT, () => console.log(`relay on :${PORT} (cjs)`));
