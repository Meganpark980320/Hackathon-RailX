const express = require("express");
const cors = require("cors");
const { ethers } = require("ethers");

const app = express();
app.use(cors());
app.use(express.json());

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const ROUTER_ADDRESS = process.env.ROUTER_ADDRESS;
const BATCH_ADDRESS  = process.env.BATCH_ADDRESS; // multicall 배치 컨트랙트
const batchAbi = [ "function multicall(bytes[] calldata) returns (bytes[])" ];
const routerAbi = [
  "function swapExactIn(address tokenIn,address tokenOut,uint256 amountIn,uint256 minOut,address to) returns (uint256)"
];

app.post("/batch", async (req, res) => {
  try {
    const { xrplAddress, evmSettlement, tokenIn, tokenOut, amountIn, minAmountOut } = req.body;

    // 1. 여기서 xrplAddress credential 검증 (예: DB lookup / 온체인 verifier call)
    if (!xrplAddress.startsWith("r")) {
      return res.status(400).json({ error: "Invalid XRPL address" });
    }

    // 2. swap calldata 준비
    const router = new ethers.Interface(routerAbi);
    const swapData = router.encodeFunctionData("swapExactIn", [
      tokenIn,
      tokenOut,
      amountIn,
      minAmountOut,
      evmSettlement,
    ]);

    // 3. 배치 실행
    const batch = new ethers.Contract(BATCH_ADDRESS, batchAbi, wallet);
    const tx = await batch.multicall([swapData]);
    const receipt = await tx.wait();

    return res.json({ ok: true, txHash: tx.hash });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

app.listen(3005, () => console.log("relay on :3005"));
