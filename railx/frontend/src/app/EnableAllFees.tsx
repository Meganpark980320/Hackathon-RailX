"use client";

import { useState } from "react";
import { createPublicClient, http } from "viem";
import { useAccount, useWalletClient } from "wagmi";
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

export default function EnableAllFees() {
  const { address } = useAccount();
  const { data: wallet } = useWalletClient();
  const [log, setLog] = useState("");

  async function run() {
    try {
      setLog("");
      if (!wallet || !address) {
        setLog("Connect wallet first.");
        return;
      }
      const owner: `0x${string}` = await pc.readContract({
        address: FACTORY_ADDRESS as `0x${string}`,
        abi: UNISWAP_V3_FACTORY_ABI,
        functionName: "owner",
      });
      if (owner.toLowerCase() !== address.toLowerCase()) {
        setLog(`❌ Not owner. Factory owner: ${owner}`);
        return;
      }

      const targets: Array<[number, number]> = [
        [500, 10],
        [3000, 60],
        [10000, 200],
      ];

      for (const [fee, spacing] of targets) {
        try {
          const sim = await pc.simulateContract({
            address: FACTORY_ADDRESS as `0x${string}`,
            abi: UNISWAP_V3_FACTORY_ABI,
            functionName: "enableFeeAmount",
            args: [fee, spacing],
            account: address,
          });
          const tx = await wallet.writeContract(sim.request);
          setLog((p) => p + `\nfee ${fee}: submitted ${tx}`);
          const r = await pc.waitForTransactionReceipt({ hash: tx });
          setLog((p) => p + `\nfee ${fee}: mined in block ${r.blockNumber}`);
        } catch (e: any) {
          setLog((p) => p + `\nfee ${fee}: ${e?.shortMessage || e?.message || String(e)}`);
        }
      }
    } catch (e: any) {
      setLog(e?.shortMessage || e?.message || String(e));
    }
  }

  return (
    <div className="rounded-xl border border-white/10 p-4 text-xs space-y-2">
      <div><b>Enable fee amounts</b> (500/3000/10000)</div>
      <button onClick={run} className="rounded-xl bg-white/10 px-4 py-2 text-sm hover:bg-white/20">
        Enable All
      </button>
      {log && <pre className="whitespace-pre-wrap">{log}</pre>}
    </div>
  );
}
