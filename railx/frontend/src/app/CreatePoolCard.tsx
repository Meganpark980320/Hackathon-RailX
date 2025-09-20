// frontend/src/app/CreatePoolCard.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  isAddress, zeroAddress, createPublicClient, http, type Address,
} from "viem";
import { useAccount, useWalletClient } from "wagmi";
import { CHAIN_ID, RPC_URL, NPM_ADDRESS } from "@/lib/config";
import { UNISWAP_V3_FACTORY_ABI } from "@/lib/abis/factoryV3";
import { erc20Abi as ERC20_ABI } from "viem";
import { NPM_ABI } from "@/lib/abis/npm";

const publicClient = createPublicClient({
  chain: { id: CHAIN_ID, name: "XRPL EVM Testnet", nativeCurrency: { name: "XRP", symbol: "XRP", decimals: 18 }, rpcUrls: { default: { http: [RPC_URL] } } },
  transport: http(RPC_URL),
});

const DEFAULT_FEE = 3000 as const;
const USE_FULL_RANGE = false;

// ── utils (동일) ─────────────────────────────────────────────────────────
function normalizePair(a: `0x${string}`, b: `0x${string}`) {
  const aa = a.toLowerCase(), bb = b.toLowerCase();
  return aa < bb ? { token0: a, token1: b, sameOrder: true } : { token0: b, token1: a, sameOrder: false };
}
function parseUnitsDecimal(v: string, decimals: number): bigint {
  const s = v.trim(); if (!s) return 0n;
  if (!/^\d+(\.\d+)?$/.test(s)) throw new Error("Invalid number format");
  const [ip, fpRaw] = s.split("."); const fp = (fpRaw || "").slice(0, decimals);
  const fpPad = (fp + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(ip || "0") * 10n ** BigInt(decimals) + BigInt(fpPad || "0");
}
function isqrt(n: bigint): bigint { if (n < 2n) return n; let x0 = 1n << (BigInt(n.toString(2).length) >> 1n), x1 = (x0 + n / x0) >> 1n; while (x1 < x0) { x0 = x1; x1 = (x0 + n / x0) >> 1n; } return x0; }
async function getReferencePriceE18(_: Address, __: Address) { return 10n ** 18n; }
function sqrtPriceX96FromE18(priceE18: bigint, dec0: number, dec1: number) {
  if (priceE18 <= 0n) throw new Error("Invalid oracle price");
  const d = BigInt(dec1 - dec0);
  const adjustedE18 = d >= 0n ? priceE18 * 10n ** d : priceE18 / 10n ** (-d);
  const TWO96 = 2n ** 96n, sqrtE18 = isqrt(adjustedE18);
  const val = (TWO96 * sqrtE18) / (10n ** 9n);
  if (val > (2n ** 160n - 1n)) throw new Error("sqrtPriceX96 overflow");
  return val;
}
function formatError(e: any) {
  return { name: e?.name, shortMessage: e?.shortMessage, message: e?.message, cause: { name: e?.cause?.name, shortMessage: e?.cause?.shortMessage, message: e?.cause?.message, data: e?.cause?.data } };
}
async function resolveFactory(): Promise<Address> {
  const f = await publicClient.readContract({
    address: NPM_ADDRESS as Address,
    abi: [{ type: "function", name: "factory", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] }] as const,
    functionName: "factory",
  });
  return f as Address;
}
// ──────────────────────────────────────────────────────────────

export default function CreatePoolCard() {
  const { address: account } = useAccount();
  const { data: walletClient } = useWalletClient();

  const [factory, setFactory] = useState<Address | null>(null);
  const [tA, setTA] = useState(""); const [tB, setTB] = useState("");
  const [fee, setFee] = useState<number>(DEFAULT_FEE);
  const [amountA, setAmountA] = useState(""); const [amountB, setAmountB] = useState("");

  const [pool, setPool] = useState<Address | null>(null);
  const [tickSpacing, setTickSpacing] = useState<number>(0);
  const [log, setLog] = useState("");

  useEffect(() => { (async () => {
    try { const f = await resolveFactory(); setFactory(f); }
    catch (e: any) { setLog(`❌ failed to read NPM.factory(): ${e?.shortMessage || e?.message}`); }
  })(); }, []);

useEffect(() => {
    let abort = false;
    (async () => {
      if (!factory) { setPool(null); setTickSpacing(0); return; }
      try {
        if (!isAddress(tA) || !isAddress(tB)) { if (!abort) { setPool(null); setTickSpacing(0); } return; }
        let ts = 0;
        try {
          const r = await publicClient.readContract({ address: factory, abi: UNISWAP_V3_FACTORY_ABI, functionName: "feeAmountTickSpacing", args: [Number(fee)] });
          ts = Number(r);
        } catch { ts = 0; }
        if (!abort) setTickSpacing(ts);

        const { token0, token1 } = normalizePair(tA as Address, tB as Address);
        const addr = (await publicClient.readContract({ address: factory, abi: UNISWAP_V3_FACTORY_ABI, functionName: "getPool", args: [token0, token1, Number(fee)] })) as Address;
        if (!abort) setPool(addr && addr.toLowerCase() !== zeroAddress ? addr : null);
      } catch { if (!abort) { setPool(null); setTickSpacing(0); } }
    })();
    return () => { abort = true; };
  }, [factory, tA, tB, fee]);

  async function ensurePoolReady(token0: Address, token1: Address, lines: string[]) {
    if (!factory) throw new Error("Factory not resolved from NPM");

    const ts = Number(await publicClient.readContract({
   address: factory,
   abi: UNISWAP_V3_FACTORY_ABI,
   functionName: "feeAmountTickSpacing",
   args: [Number(fee)],
 }));
 if (ts === 0) {
   throw new Error(`Fee ${fee} not enabled on factory ${factory} (tickSpacing=0). Ask factory owner to call enableFeeAmount(${fee}, <tickSpacing>)`);
 }

    // 0) 현재 상태
    const before = (await publicClient.readContract({ address: factory, abi: UNISWAP_V3_FACTORY_ABI, functionName: "getPool", args: [token0, token1, Number(fee)] })) as Address;
    lines.push(`[factory=${factory}] before.getPool=${before}`);

    // 1) NPM 경로: create+init (리턴 pool 주소 받기)
    const [dec0, dec1, priceE18] = await Promise.all([
      publicClient.readContract({ address: token0, abi: ERC20_ABI, functionName: "decimals" }) as Promise<number>,
      publicClient.readContract({ address: token1, abi: ERC20_ABI, functionName: "decimals" }) as Promise<number>,
      getReferencePriceE18(token0, token1),
    ]);
    const sqrt = sqrtPriceX96FromE18(priceE18, dec0, dec1);
    lines.push(`[oracle] priceE18=${priceE18.toString()} sqrt=${sqrt.toString()} (dec0=${dec0}, dec1=${dec1})`);

    let poolAddr: Address | null = null;
    try {
      const sim = await publicClient.simulateContract({
        address: NPM_ADDRESS as Address, abi: NPM_ABI, functionName: "createAndInitializePoolIfNecessary",
        args: [token0, token1, Number(fee), sqrt], account: (await walletClient!.getAddresses())[0],
      });
      const txHash = await walletClient!.writeContract(sim.request);
      lines.push(`[tx] NPM.createAndInitializePoolIfNecessary: ${txHash}`);
      await publicClient.waitForTransactionReceipt({ hash: txHash });

      // 이 함수는 보통 pool 주소를 반환한다 → 시도해서 로그
      // try {
      //   // viem simulate 결과(request)로는 반환값을 못 읽으니, 체인에서 다시 조회
      //   const addr = (await publicClient.readContract({ address: factory, abi: UNISWAP_V3_FACTORY_ABI, functionName: "getPool", args: [token0, token1, Number(fee)] })) as Address;
      //   poolAddr = addr && addr.toLowerCase() !== zeroAddress ? (addr as Address) : null;
      // } catch {}

   const ret = sim.result as Address;
   if (ret && ret.toLowerCase() !== zeroAddress) poolAddr = ret as Address;

    } catch (e: any) {
      lines.push(`[NPM] createAndInitialize… revert/skip: ${e?.shortMessage || e?.message}`);
    }

    // 2) 그래도 없으면 → factory.createPool 폴백
    if (!poolAddr) {
      try {
        const sim2 = await publicClient.simulateContract({
          address: factory, abi: UNISWAP_V3_FACTORY_ABI, functionName: "createPool",
          args: [token0, token1, Number(fee)], account: (await walletClient!.getAddresses())[0],
        });
        const tx2 = await walletClient!.writeContract(sim2.request);
        lines.push(`[tx] factory.createPool: ${tx2}`);
        await publicClient.waitForTransactionReceipt({ hash: tx2 });
      } catch (e: any) {
        lines.push(`[factory] createPool failed: ${e?.shortMessage || e?.message}`);
      }
    }

    // 3) 재시도 조회(최대 3회, 500ms 간격)
    let addr: Address | null = null;
    for (let i = 0; i < 12; i++) { 
      const a = (await publicClient.readContract({ address: factory, abi: UNISWAP_V3_FACTORY_ABI, functionName: "getPool", args: [token0, token1, Number(fee)] })) as Address;
      if (a && a.toLowerCase() !== zeroAddress) { addr = a as Address; break; }
      await new Promise(r => setTimeout(r, 500));
    }
    if (!addr) throw new Error("Pool not found after ensurePoolReady");
    setPool(addr);
    lines.push(`[pool] ${addr}`);

    // 4) slot0 확인, 필요 시 initialize(직접)
    const slot0 = (await publicClient.readContract({
      address: addr, abi: [{ type: "function", name: "slot0", stateMutability: "view", inputs: [], outputs: [
        { type: "uint160", name: "sqrtPriceX96" }, { type: "int24", name: "tick" },
        { type: "uint16", name: "observationIndex" }, { type: "uint16", name: "observationCardinality" },
        { type: "uint16", name: "observationCardinalityNext" }, { type: "uint8", name: "feeProtocol" }, { type: "bool", name: "unlocked" },
      ] } ] as const, functionName: "slot0", args: [],
    })) as any;
    const sqrt0 = BigInt(slot0[0]); lines.push(`[slot0] sqrtPriceX96=${sqrt0.toString()} tick=${slot0[1]}`);

    if (sqrt0 === 0n) {
      // initialize 직접 호출
      try {
        const simI = await publicClient.simulateContract({
          address: addr, abi: [{ type: "function", name: "initialize", stateMutability: "nonpayable", inputs: [{ name: "sqrtPriceX96", type: "uint160" }], outputs: [] }] as const,
          functionName: "initialize", args: [sqrt], account: (await walletClient!.getAddresses())[0],
        });
        const txI = await walletClient!.writeContract(simI.request);
        lines.push(`[tx] pool.initialize: ${txI}`);
        await publicClient.waitForTransactionReceipt({ hash: txI });
        await new Promise(r => setTimeout(r, 1500));
      } catch (e: any) {
        lines.push(`[pool] initialize failed: ${e?.shortMessage || e?.message}`);
        throw new Error("Pool exists but not initialized (initialize failed)");
      }
    }

    // 최종 slot0
    const slot1 = (await publicClient.readContract({
      address: addr, abi: [{ type: "function", name: "slot0", stateMutability: "view", inputs: [], outputs: [
        { type: "uint160", name: "sqrtPriceX96" }, { type: "int24", name: "tick" },
        { type: "uint16", name: "observationIndex" }, { type: "uint16", name: "observationCardinality" },
        { type: "uint16", name: "observationCardinalityNext" }, { type: "uint8", name: "feeProtocol" }, { type: "bool", name: "unlocked" },
      ] } ] as const, functionName: "slot0", args: [],
    })) as any;
    lines.push(`[slot0-final] sqrtPriceX96=${slot1[0]} tick=${slot1[1]}`);
    return { poolAddr: addr as Address, tick: Number(slot1[1]) as number };
  }

  async function ensureAllowanceAndBalance(token: Address, owner: Address, spender: Address, need: bigint, lines: string[]) {
    if (need === 0n) return;
    const [allow, bal] = await Promise.all([
      publicClient.readContract({ address: token, abi: ERC20_ABI, functionName: "allowance", args: [owner, spender] }) as Promise<bigint>,
      publicClient.readContract({ address: token, abi: ERC20_ABI, functionName: "balanceOf", args: [owner] }) as Promise<bigint>,
    ]);
    lines.push(`[check] ${token} allowance=${allow.toString()} balance=${bal.toString()} need=${need.toString()}`);
    if (bal < need) throw new Error(`Insufficient balance for ${token}: have=${bal.toString()}, need=${need.toString()}`);
    if (allow < need) {
      const sim = await publicClient.simulateContract({ address: token, abi: ERC20_ABI, functionName: "approve", args: [spender, need], account: owner });
      const tx = await walletClient!.writeContract(sim.request);
      lines.push(`[approve] ${token} -> ${spender}, amount=${need.toString()} (tx=${tx})`);
      await publicClient.waitForTransactionReceipt({ hash: tx });
    } else {
      lines.push(`[approve] skip ${token} (enough allowance)`);
    }
  }

  async function createInitAndMint() {
    const lines: string[] = [];
    try {
      setLog("");

      if (!walletClient || !account) { setLog("Connect wallet first."); return; }
      if (!factory) { setLog("Factory not resolved from NPM yet."); return; }

      // 체인 체크
      try { const c = await walletClient.getChainId(); if (c !== CHAIN_ID) lines.push(`⚠️ Wallet chainId=${c}, expected ${CHAIN_ID}.`); } catch {}

      if (!isAddress(tA) || !isAddress(tB)) { setLog("Invalid token address."); return; }
      const { token0, token1, sameOrder } = normalizePair(tA as Address, tB as Address);
      if (token0.toLowerCase() === token1.toLowerCase()) { setLog("token0 and token1 must be different."); return; }
      lines.push(`[pair] inputA=${tA} inputB=${tB} -> token0=${token0} token1=${token1} sameOrder=${sameOrder}`);

      // amounts: A/B 디시멀로 파싱 → 매핑
      const [decA, decB] = await Promise.all([
        publicClient.readContract({ address: tA as Address, abi: ERC20_ABI, functionName: "decimals" }) as Promise<number>,
        publicClient.readContract({ address: tB as Address, abi: ERC20_ABI, functionName: "decimals" }) as Promise<number>,
      ]);
      const amtA = parseUnitsDecimal(amountA || "0", decA);
      const amtB = parseUnitsDecimal(amountB || "0", decB);
      const amount0Desired = sameOrder ? amtA : amtB;
      const amount1Desired = sameOrder ? amtB : amtA;
      lines.push(`[amounts] A=${amtA} (dec=${decA}) B=${amtB} (dec=${decB})`);
      lines.push(`[mapped] amount0=${amount0Desired} amount1=${amount1Desired}`);
      if (amount0Desired === 0n && amount1Desired === 0n) { setLog(lines.concat(["ℹ️ No amounts provided"]).join("\n")); return; }

      // tickSpacing
      const ts = Number(await publicClient.readContract({ address: factory, abi: UNISWAP_V3_FACTORY_ABI, functionName: "feeAmountTickSpacing", args: [Number(fee)] }));
      if (ts === 0) { setLog(lines.concat([`❌ Fee ${fee} not enabled on factory ${factory}`]).join("\n")); return; }
      lines.push(`[factory=${factory}] fee=${fee} -> tickSpacing=${ts}`);

      // 풀 보장 (NPM → factory 폴백 → initialize)
      const { poolAddr, tick } = await ensurePoolReady(token0, token1, lines);

      // 틱 범위
      const base = Math.trunc(tick / ts) * ts;
      const tickLower = USE_FULL_RANGE ? Math.ceil(-887272 / ts) * ts : base - 2 * ts;
      const tickUpper = USE_FULL_RANGE ? Math.floor( 887272 / ts) * ts : base + 2 * ts;
      lines.push(`[range] ${USE_FULL_RANGE ? "full" : "near-spot"}: [${tickLower}, ${tickUpper}] (tick=${tick}, spacing=${ts})`);

      // approve+balance (spender = NPM)
      const owner = account as Address;
      await ensureAllowanceAndBalance(sameOrder ? (tA as Address) : (tB as Address), owner, NPM_ADDRESS as Address, amount0Desired, lines);
      await ensureAllowanceAndBalance(sameOrder ? (tB as Address) : (tA as Address), owner, NPM_ADDRESS as Address, amount1Desired, lines);

      // mint
      const deadline = Math.floor(Date.now() / 1000) + 600;
      const simMint = await publicClient.simulateContract({
        address: NPM_ADDRESS as Address, abi: NPM_ABI, functionName: "mint",
        args: [{ token0, token1, fee: Number(fee), tickLower, tickUpper, amount0Desired, amount1Desired,
                 amount0Min: 0n, amount1Min: 0n, recipient: owner, deadline }],
        account: owner,
      });
      lines.push(`[simulate] mint gas=${String(simMint.request.gas ?? "n/a")}`);
      lines.push(`[final-args] token0=${token0}, token1=${token1}, fee=${fee}, ticks=[${tickLower}, ${tickUpper}]`);

      const txMint = await walletClient!.writeContract(simMint.request);
      lines.push(`[tx] mint: ${txMint}`);
      const rcMint = await publicClient.waitForTransactionReceipt({ hash: txMint });
      lines.push(`[tx] mint mined in block ${rcMint.blockNumber}`);
      lines.push(`[pool] ${poolAddr}`);

      setLog(lines.join("\n"));
    } catch (e: any) {
      const err = ["❌ create/init/mint failed", JSON.stringify(formatError(e), null, 2)].join("\n");
      setLog(prev => (prev ? prev + "\n" + err : err)); // 누적 표시
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-white/10 p-4">
      <div className="text-sm font-semibold">Create & Initialize (via FX Oracle) & Seed Liquidity</div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <input className="w-full rounded-md bg-black/30 p-2 text-sm font-mono" placeholder="token A address (any order)" value={tA} onChange={e=>setTA(e.target.value.trim())}/>
        <input className="w-full rounded-md bg-black/30 p-2 text-sm font-mono" placeholder="token B address (any order)" value={tB} onChange={e=>setTB(e.target.value.trim())}/>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs opacity-80">Fee (uint24):</label>
        <select className="rounded-md bg-black/30 p-2 text-sm" value={fee} onChange={e=>setFee(Number(e.target.value))}>
          <option value={500}>0.05% (500)</option><option value={3000}>0.3% (3000)</option><option value={10000}>1% (10000)</option>
        </select>
        <div className="text-xs opacity-70">tickSpacing: {factory ? (tickSpacing || "(unknown)") : "(resolving factory...)"}</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <input className="w-full rounded-md bg-black/30 p-2 text-sm font-mono" placeholder="Amount for token A (human)" value={amountA} onChange={e=>setAmountA(e.target.value.trim())}/>
        <input className="w-full rounded-md bg-black/30 p-2 text-sm font-mono" placeholder="Amount for token B (human)" value={amountB} onChange={e=>setAmountB(e.target.value.trim())}/>
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={createInitAndMint} className="rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/20" disabled={!factory}>
          Create + Initialize(FX Oracle) + Mint
        </button>
      </div>

      <div className="text-xs opacity-80">Pool: {pool ?? "(not created)"} </div>

      {log && <pre className="whitespace-pre-wrap rounded-md bg-black/40 p-2 text-xs mt-1">{log}</pre>}
    </div>
  );
}
