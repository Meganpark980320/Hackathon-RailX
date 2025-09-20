"use client";

import { useState } from "react";
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  useSwitchChain,
  useChains,
} from "wagmi";

const TARGET_CHAIN_ID = 1449000; // XRPL EVM Testnet (네가 정의한 체인)

function short(addr?: string) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";
}

export default function WalletButtons() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connectAsync, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const chains = useChains();

  const [busy, setBusy] = useState<string | null>(null);
  const target = chains.find((c) => c.id === TARGET_CHAIN_ID);

  async function onConnect() {
    try {
      setBusy("connect");
      // 우선순위: Injected(메타마스크)
      const injected = connectors.find((c) => c.id === "injected") ?? connectors[0];
      if (!injected) throw new Error("No wallet connector available");
      await connectAsync({ connector: injected });
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  async function onSwitch() {
    try {
      setBusy("switch");
      await switchChainAsync({ chainId: TARGET_CHAIN_ID });
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setBusy(null);
    }
  }

  if (!isConnected) {
    return (
      <button
        onClick={onConnect}
        disabled={isConnecting || busy === "connect"}
        className="px-4 py-2 rounded-2xl bg-white text-black font-medium disabled:opacity-60"
      >
        {busy === "connect" ? "Connecting..." : "Connect Wallet"}
      </button>
    );
  }

  // 연결은 되었는데 체인이 다르면 스위치 버튼 노출
  if (chainId !== TARGET_CHAIN_ID) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-neutral-400">{short(address)}</span>
        <button
          onClick={onSwitch}
          disabled={isSwitching || busy === "switch"}
          className="px-4 py-2 rounded-2xl bg-yellow-300 text-black font-medium disabled:opacity-60"
        >
          {busy === "switch"
            ? "Switching..."
            : `Switch to ${target?.name ?? `Chain ${TARGET_CHAIN_ID}`}`}
        </button>
        <button
          onClick={() => disconnect()}
          className="px-3 py-2 rounded-2xl border text-sm"
        >
          Disconnect
        </button>
      </div>
    );
  }

  // 올바른 체인 + 연결 완료
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm px-3 py-1 rounded-full bg-neutral-900 border">
        {target?.name ?? `Chain ${TARGET_CHAIN_ID}`}
      </span>
      <span className="text-sm text-neutral-400">{short(address)}</span>
      <button
        onClick={() => disconnect()}
        className="px-3 py-2 rounded-2xl border text-sm"
      >
        Disconnect
      </button>
    </div>
  );
}
