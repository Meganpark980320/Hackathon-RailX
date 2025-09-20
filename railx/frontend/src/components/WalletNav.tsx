"use client";

import { useMemo } from "react";
import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from "wagmi";

const TARGET_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 0);

function short(addr?: string) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";
}

export default function WalletNav() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const { connectors, connect, status: connectStatus } = useConnect();
  const { disconnect } = useDisconnect();
  const { chains, switchChain, isPending: switching } = useSwitchChain();

  const wrongNetwork = useMemo(() => {
    if (!TARGET_CHAIN_ID) return false; // 체인 강제 안함
    return !!chainId && chainId !== TARGET_CHAIN_ID;
  }, [chainId]);

  // 미연결 상태: 커넥터 버튼 노출
  if (!isConnected) {
    return (
      <div className="flex items-center gap-2">
        {connectors.map((c) => (
          <button
            key={(c as any).uid || c.id}
            onClick={() => connect({ connector: c })}
            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm"
            disabled={connectStatus === "pending"}
          >
            {connectStatus === "pending" ? "Connecting…" : `Connect ${c.name}`}
          </button>
        ))}
      </div>
    );
  }

  // 연결 상태
  return (
    <div className="flex items-center gap-2">
      {wrongNetwork ? (
        <button
          onClick={() => {
            const target = TARGET_CHAIN_ID && chains.find((ch) => ch.id === TARGET_CHAIN_ID);
            if (target) switchChain({ chainId: target.id });
          }}
          className="px-3 py-2 rounded-xl bg-amber-500/90 hover:bg-amber-400 text-sm"
          disabled={switching}
        >
          {switching ? "Switching…" : "Switch Network"}
        </button>
      ) : (
        <span className="px-3 py-2 rounded-xl bg-white/10 text-sm">
          {chains.find((ch) => ch.id === chainId)?.name || `Chain ${chainId}`}
        </span>
      )}

      <span className="px-3 py-2 rounded-xl bg-white/10 text-sm">{short(address)}</span>
      <button
        onClick={() => disconnect()}
        className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm"
      >
        Disconnect
      </button>
    </div>
  );
}
