"use client";

import { useEffect, useState } from "react";
import { createPublicClient, http } from "viem";
import { useAccount } from "wagmi";
import { CHAIN_ID, RPC_URL, FACTORY_ADDRESS } from "@/lib/config";
import { UNISWAP_V3_FACTORY_ABI } from "@/lib/abis/factoryV3";

const pc = createPublicClient({
  chain: {
    id: CHAIN_ID,
    name: "XRPL EVM Testnet",
    nativeCurrency: { name: "XRP", symbol: "XRP", decimals: 18 },
    rpcUrls: { default: { http: [RPC_URL] } },
  },
  transport: http(RPC_URL),
});

export default function FactoryInfo() {
  const { address } = useAccount();
  const [owner, setOwner] = useState<`0x${string}`>();
  const [tick500, setTick500] = useState<number>();
  const [tick3000, setTick3000] = useState<number>();
  const [tick10000, setTick10000] = useState<number>();
  const [err, setErr] = useState<string>();

  useEffect(() => {
    (async () => {
      try {
        setErr(undefined);
        const o = await pc.readContract({
          address: FACTORY_ADDRESS as `0x${string}`,
          abi: UNISWAP_V3_FACTORY_ABI,
          functionName: "owner",
        });
        setOwner(o as `0x${string}`);

        const a = await pc.readContract({
          address: FACTORY_ADDRESS as `0x${string}`,
          abi: UNISWAP_V3_FACTORY_ABI,
          functionName: "feeAmountTickSpacing",
          args: [500],
        });
        const b = await pc.readContract({
          address: FACTORY_ADDRESS as `0x${string}`,
          abi: UNISWAP_V3_FACTORY_ABI,
          functionName: "feeAmountTickSpacing",
          args: [3000],
        });
        const c = await pc.readContract({
          address: FACTORY_ADDRESS as `0x${string}`,
          abi: UNISWAP_V3_FACTORY_ABI,
          functionName: "feeAmountTickSpacing",
          args: [10000],
        });
        setTick500(Number(a));
        setTick3000(Number(b));
        setTick10000(Number(c));
      } catch (e: any) {
        setErr(e?.shortMessage || e?.message || String(e));
      }
    })();
  }, []);

  return (
    <div className="rounded-xl border border-white/10 p-4 text-xs space-y-2">
      <div><b>Factory</b>: {FACTORY_ADDRESS}</div>
      {owner && (
        <div>
          <div><b>Owner</b>: {owner}</div>
          <div><b>Your Wallet</b>: {address ?? "(not connected)"}</div>
        </div>
      )}
      <div>fee 500 → tickSpacing: {tick500 ?? "?"}</div>
      <div>fee 3000 → tickSpacing: {tick3000 ?? "?"}</div>
      <div>fee 10000 → tickSpacing: {tick10000 ?? "?"}</div>
      {err && <div className="text-red-400">Error: {err}</div>}
    </div>
  );
}
