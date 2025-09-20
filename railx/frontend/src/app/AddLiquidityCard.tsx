"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import type { Address } from "viem";
import { isAddress, parseUnits, formatUnits } from "viem";
import { POOL_ABI } from "@/lib/abis/pool";
import { ERC20_ABI } from "@/lib/abis/erc20";
import { DEFAULT_POOL_ADDRESS } from "@/lib/config";

const ZERO = "0x0000000000000000000000000000000000000000" as Address;

export default function AddLiquidityCard() {
  const { address } = useAccount();
  const client = usePublicClient();
  const { writeContractAsync, isPending } = useWriteContract();

  // 풀 주소 입력 (기본값: 방금 만든 풀)
  const [pool, setPool] = useState<Address>(DEFAULT_POOL_ADDRESS);
  const poolOk = isAddress(pool);

  // 메타 정보
  const [token0, setToken0] = useState<Address | null>(null);
  const [token1, setToken1] = useState<Address | null>(null);
  const [sym0, setSym0] = useState<string>("-");
  const [sym1, setSym1] = useState<string>("-");
  const [dec0, setDec0] = useState<number>(18);
  const [dec1, setDec1] = useState<number>(18);
  const [stable, setStable] = useState<boolean>(false);
  const [feeBps, setFeeBps] = useState<number>(0);

  // 리저브/밸런스
  const [reserve0, setReserve0] = useState<bigint>(0n);
  const [reserve1, setReserve1] = useState<bigint>(0n);
  const [bal0, setBal0] = useState<bigint>(0n);
  const [bal1, setBal1] = useState<bigint>(0n);
  const [allow0, setAllow0] = useState<bigint>(0n);
  const [allow1, setAllow1] = useState<bigint>(0n);

  // 입력 금액
  const [amt0, setAmt0] = useState<string>("0");
  const [amt1, setAmt1] = useState<string>("0");

  // 풀/토큰 정보 로드
  useEffect(() => {
    (async () => {
      try {
        if (!poolOk) return;
        const [t0, t1, st, fb] = await Promise.all([
          client.readContract({ address: pool, abi: POOL_ABI, functionName: "token0" }) as Promise<Address>,
          client.readContract({ address: pool, abi: POOL_ABI, functionName: "token1" }) as Promise<Address>,
          client.readContract({ address: pool, abi: POOL_ABI, functionName: "isStable" }) as Promise<boolean>,
          client.readContract({ address: pool, abi: POOL_ABI, functionName: "feeBps" }) as Promise<number>,
        ]);
        setToken0(t0); setToken1(t1); setStable(st); setFeeBps(Number(fb));

        const [s0, s1, d0, d1] = await Promise.all([
          client.readContract({ address: t0, abi: ERC20_ABI, functionName: "symbol" }) as Promise<string>,
          client.readContract({ address: t1, abi: ERC20_ABI, functionName: "symbol" }) as Promise<string>,
          client.readContract({ address: t0, abi: ERC20_ABI, functionName: "decimals" }) as Promise<number>,
          client.readContract({ address: t1, abi: ERC20_ABI, functionName: "decimals" }) as Promise<number>,
        ]);
        setSym0(s0); setSym1(s1); setDec0(Number(d0)); setDec1(Number(d1));
      } catch (e) {
        console.error(e);
      }
    })();
  }, [pool, poolOk, client]);

  // 리저브/밸런스/알로언스 로드
  async function refresh() {
    if (!poolOk || !token0 || !token1) return;
    const [r0, r1, b0, b1, a0, a1] = await Promise.all([
      client.readContract({ address: pool, abi: POOL_ABI, functionName: "reserve0" }) as Promise<bigint>,
      client.readContract({ address: pool, abi: POOL_ABI, functionName: "reserve1" }) as Promise<bigint>,
      address ? client.readContract({ address: token0, abi: ERC20_ABI, functionName: "balanceOf", args: [address] }) as Promise<bigint> : Promise.resolve(0n),
      address ? client.readContract({ address: token1, abi: ERC20_ABI, functionName: "balanceOf", args: [address] }) as Promise<bigint> : Promise.resolve(0n),
      address ? client.readContract({ address: token0, abi: ERC20_ABI, functionName: "allowance", args: [address, pool] }) as Promise<bigint> : Promise.resolve(0n),
      address ? client.readContract({ address: token1, abi: ERC20_ABI, functionName: "allowance", args: [address, pool] }) as Promise<bigint> : Promise.resolve(0n),
    ]);
    setReserve0(r0); setReserve1(r1);
    setBal0(b0); setBal1(b1);
    setAllow0(a0); setAllow1(a1);
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [token0, token1, address, pool]);

  const need0 = useMemo(() => {
    try { return parseUnits(amt0 || "0", dec0); } catch { return 0n; }
  }, [amt0, dec0]);

  const need1 = useMemo(() => {
    try { return parseUnits(amt1 || "0", dec1); } catch { return 0n; }
  }, [amt1, dec1]);

  async function ensureApproval(token: Address, amount: bigint) {
    if (!address) throw new Error("Connect wallet");
    if (amount <= 0n) return;
    const current = await client.readContract({
      address: token, abi: ERC20_ABI, functionName: "allowance", args: [address, pool]
    }) as bigint;
    if (current >= amount) return;

    // 수수료 추정 (EIP-1559 실패 시 fallback)
    const fees = await client.estimateFeesPerGas({ type: "eip1559" })
      .catch(async () => ({ gasPrice: await client.getGasPrice() }));

    await writeContractAsync({
      address: token, abi: ERC20_ABI, functionName: "approve",
      args: [pool, amount],
      ...( "maxFeePerGas" in fees
        ? { maxFeePerGas: fees.maxFeePerGas, maxPriorityFeePerGas: fees.maxPriorityFeePerGas }
        : { gasPrice: (fees as any).gasPrice }
      ),
    });
  }

  async function onAdd() {
    if (!address) throw new Error("Connect wallet");
    if (!poolOk || !token0 || !token1) throw new Error("Invalid pool");
    if (need0 === 0n && need1 === 0n) throw new Error("Enter amounts");

    // 승인
    await ensureApproval(token0, need0);
    await ensureApproval(token1, need1);

    const fees = await client.estimateFeesPerGas({ type: "eip1559" })
      .catch(async () => ({ gasPrice: await client.getGasPrice() }));

    const txHash = await writeContractAsync({
      address: pool,
      abi: POOL_ABI,
      functionName: "addLiquidity",
      args: [need0, need1, address],
      ...( "maxFeePerGas" in fees
        ? { maxFeePerGas: fees.maxFeePerGas, maxPriorityFeePerGas: fees.maxPriorityFeePerGas }
        : { gasPrice: (fees as any).gasPrice }
      ),
    });

    await client.waitForTransactionReceipt({ hash: txHash });
    await refresh();
    alert("Liquidity added ✅");
  }

  const enough0 = bal0 >= need0;
  const enough1 = bal1 >= need1;

  return (
    <div className="max-w-xl mx-auto mt-8 rounded-2xl p-6 border bg-black/20 backdrop-blur">
      <h2 className="text-xl font-semibold mb-4">Add Liquidity (Direct Pool)</h2>

      <label className="text-sm mb-1 block">Pool address</label>
      <input
        className="w-full px-3 py-2 rounded bg-neutral-900 border mb-3"
        value={pool}
        onChange={(e) => setPool(e.target.value as Address)}
        placeholder="0x..."
      />

      <div className="text-xs text-neutral-400 mb-3">
        {poolOk ? (
          <>
            <div>type: {stable ? "Stable" : "Volatile"} · fee: {feeBps} bps</div>
            <div>token0: {token0 ?? "-"} ({sym0}) / token1: {token1 ?? "-"} ({sym1})</div>
            <div>reserves: {formatUnits(reserve0, dec0)} {sym0} · {formatUnits(reserve1, dec1)} {sym1}</div>
          </>
        ) : <span>Invalid pool address</span>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm mb-1 block">Amount {sym0} (token0)</label>
          <input
            className="w-full px-3 py-2 rounded bg-neutral-900 border"
            value={amt0}
            onChange={(e) => setAmt0(e.target.value)}
            placeholder="0.0"
          />
          <div className="flex items-center justify-between text-xs text-neutral-400 mt-1">
            <span>bal: {formatUnits(bal0, dec0)}</span>
            <button
              className="underline"
              onClick={() => setAmt0(formatUnits(bal0, dec0))}
              type="button"
            >
              Max
            </button>
          </div>
          {need0 > 0n && !enough0 && <p className="text-xs text-red-400 mt-1">Insufficient balance</p>}
        </div>
        <div>
          <label className="text-sm mb-1 block">Amount {sym1} (token1)</label>
          <input
            className="w-full px-3 py-2 rounded bg-neutral-900 border"
            value={amt1}
            onChange={(e) => setAmt1(e.target.value)}
            placeholder="0.0"
          />
          <div className="flex items-center justify-between text-xs text-neutral-400 mt-1">
            <span>bal: {formatUnits(bal1, dec1)}</span>
            <button
              className="underline"
              onClick={() => setAmt1(formatUnits(bal1, dec1))}
              type="button"
            >
              Max
            </button>
          </div>
          {need1 > 0n && !enough1 && <p className="text-xs text-red-400 mt-1">Insufficient balance</p>}
        </div>
      </div>

      <button
        onClick={onAdd}
        disabled={!address || !poolOk || isPending}
        className="w-full mt-4 py-2 rounded-2xl font-medium bg-white text-black disabled:opacity-50"
      >
        {isPending ? "Submitting..." : "Add Liquidity"}
      </button>
    </div>
  );
}
