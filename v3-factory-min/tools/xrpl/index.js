import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

const provider = new ethers.JsonRpcProvider(process.env.EVM_RPC);
const wallet = new ethers.Wallet(process.env.EVM_PRIVATE_KEY, provider);

// 📍 컨트랙트 주소
const routerAddr = "0xC9c9c99c227784CF21A0188b8297ee249E49081B";
const krwk = "0x020753765a016cC6cFba2c6357084004746260E9";
const usdc = "0x99221eE49A71E6D071330ba86A09EbAddcf05af3";
const recipient = wallet.address; // 본인 지갑으로 수령

// 📍 ABI
const routerAbi = [
  "function setPrice(address tokenIn, address tokenOut, uint256 num, uint256 den) external",
  "function swapExactIn(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address to) external returns (uint256)"
];
const erc20Abi = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function balanceOf(address owner) view returns (uint256)"
];

async function main() {
  const router = new ethers.Contract(routerAddr, routerAbi, wallet);
  const usdcErc20 = new ethers.Contract(usdc, erc20Abi, wallet);

  // ============================================================
  // 1. 오너 계정에서 가격 세팅 (1,000,000 KRWK → 769.230769230769230769 USDC)
  // ============================================================
  console.log("📍 Setting price KRWK → USDC...");
  const tx1 = await router.setPrice(
    krwk,
    usdc,
    ethers.parseUnits("769.230769230769230769", 18), // num
    ethers.parseUnits("1000000", 18),                  // den
    { gasPrice: ethers.parseUnits("500", "gwei") }
  );
  await tx1.wait();
  console.log("✅ Price set:", tx1.hash);

  // ============================================================
  // 2. 라우터가 실제 USDC 유동성을 보유해야 swap 성공
  // ============================================================
  const liquidityAmount = ethers.parseUnits("10000", 18); // 10,000 USDC 예시
  console.log("📍 Funding Router with", liquidityAmount.toString(), "USDC...");

  const tx2 = await usdcErc20.transfer(routerAddr, liquidityAmount);
  await tx2.wait();
  console.log("✅ Liquidity funded:", tx2.hash);

  // ============================================================
  // 3. 스왑 실행: 1,000,000 KRWK → 약 769.23 USDC
  // ============================================================
  const amountIn = ethers.parseUnits("1000000", 18);   // 1,000,000 KRWK
  const minAmountOut = ethers.parseUnits("769", 18);   // 최소 769 USDC

  console.log("📍 Swapping...");
  const tx3 = await router.swapExactIn(krwk, usdc, amountIn, minAmountOut, recipient);
  await tx3.wait();
  console.log("✅ Swap tx:", tx3.hash);
}

main().catch((e) => {
  console.error("❌ Error:", e);
});
