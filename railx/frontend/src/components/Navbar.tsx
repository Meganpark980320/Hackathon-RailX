"use client";
<nav className="w-full sticky top-0 z-40 border-b border-white/10 bg-[#0b1220]/80 backdrop-blur">
<div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
<div className="flex items-center gap-3">
<span className="text-lg font-semibold">Transfer</span>
{wrongNetwork && (
<span className="text-amber-300 text-xs px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30">
Wrong network
</span>
)}
</div>


{/* Right side: wallet */}
<div className="flex items-center gap-2">
{!isConnected && (
<div className="flex items-center gap-2">
{connectors.map((c) => (
<button
key={c.uid}
onClick={() => connect({ connector: c })}
className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm"
disabled={status === "pending"}
>
{status === "pending" ? "Connecting…" : `Connect ${c.name}`}
</button>
))}
</div>
)}


{isConnected && (
<div className="flex items-center gap-2">
{/* Network switch if needed */}
{wrongNetwork ? (
<button
onClick={() => {
const t = TARGET_CHAIN_ID && chains.find((ch) => ch.id === TARGET_CHAIN_ID);
if (t) switchChain({ chainId: t.id });
}}
className="px-3 py-2 rounded-xl bg-amber-500/90 hover:bg-amber-400 text-sm"
disabled={switching}
>
{switching ? "Switching…" : "Switch Network"}
</button>
) : (
<span className="px-3 py-2 rounded-xl bg-white/10 text-sm">{chains.find((ch) => ch.id === chainId)?.name || `Chain ${chainId}`}</span>
)}


<span className="px-3 py-2 rounded-xl bg-white/10 text-sm">{short(address as string)}</span>
<button onClick={() => disconnect()} className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-sm">
Disconnect
</button>
</div>
)}
</div>
</div>
</nav>
);
}