"use client";

import { useEffect, useMemo, useState } from "react";
import {
  parseUnits,
  formatUnits,
  isAddress,
  encodeFunctionData,
  type Address,
} from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";

// ---- env & router addr ----
const RAW_ROUTER = process.env.NEXT_PUBLIC_ROUTER ?? "";
const ROUTER_ADDRESS: Address | undefined = isAddress(RAW_ROUTER)
  ? (RAW_ROUTER as Address)
  : undefined;

const RELAY_URL = process.env.NEXT_PUBLIC_RELAY_URL || "http://localhost:3001";
const API_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN || "";

// XRPL Classic r-addr quick check (loose)
const XRPL_REGEX = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;
const isXrplClassic = (v: string) => XRPL_REGEX.test(v.trim());

// User-provided tokens (all 18 decimals per latest context)
const TOKENS: Record<string, { address: Address; decimals: number }> = {
  RLUSD: { address: "0xe24E1EE89A4A6619b417Bc4b6988c2c81948948b" as Address, decimals: 18 },
  USDT:  { address: "0xa73c62e25D97bAD7784A9cfb60Db2FB7c63df485" as Address, decimals: 18 },
  USDC:  { address: "0x99221eE49A71E6D071330ba86A09EbAddcf05af3" as Address, decimals: 18 },
  JPYC:  { address: "0x58DdB96ce001152a08eb8f53E93b49eB97887E84" as Address, decimals: 18 },
  KRWK:  { address: "0x020753765a016cC6cFba2c6357084004746260E9" as Address, decimals: 18 },
};

// ---- Demo oracle: units per 1 USD (fixed demo rates) ----
const UNIT_PER_USD: Record<string, number> = {
  RLUSD: 1,
  USDT: 1,
  USDC: 1,
  JPYC: 150,
  KRWK: 1300,
};
function quoteOut(amountIn: bigint, fromSym: string, toSym: string): bigint {
  const uIn = BigInt(UNIT_PER_USD[fromSym]);
  const uOut = BigInt(UNIT_PER_USD[toSym]);
  return amountIn === 0n ? 0n : (amountIn * uOut) / uIn;
}

// ---- Minimal ABIs ----
const erc20Abi = [
  { inputs: [], name: "decimals",  outputs: [{ type: "uint8" }],   stateMutability: "view",       type: "function" },
  { inputs: [], name: "symbol",    outputs: [{ type: "string" }],  stateMutability: "view",       type: "function" },
  { inputs: [{ name: "owner", type: "address" }], name: "balanceOf", outputs: [{ type: "uint256"}], stateMutability: "view", type: "function" },
  { inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], name: "allowance", outputs: [{ type: "uint256"}], stateMutability: "view", type: "function" },
  { inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], name: "approve", outputs: [{ type: "bool"}], stateMutability: "nonpayable", type: "function" },
] as const;

const routerAbi = [
  {
    inputs: [
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "minAmountOut", type: "uint256" },
      { name: "to", type: "address" },
    ],
    name: "swapExactIn",
    outputs: [{ name: "amountOut", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

/**
 * (가정) 배치 라우터는 Multicall 스타일 시그니처를 가진다.
 * - 네 쪽 relayer가 최종적으로 호출하는 온체인 진입점.
 * - 실제 컨트랙트는 BatchRouter.multicall(bytes[]) 또는 Router.multicall(bytes[])
 * - 여기선 서버가 알아서 붙일 것이므로, 프론트는 calldata 조립만 한다.
 */
type EncodedCall = `0x${string}`;

export default function TransferPage() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const tokenSymbols = Object.keys(TOKENS);
  const [from, setFrom] = useState<string>("USDC");
  const [to, setTo] = useState<string>("KRWK");
  const [amount, setAmount] = useState<string>("");
  const [slippage, setSlippage] = useState<string>("0.5"); // %
  const [xrplAddr, setXrplAddr] = useState<string>("");    // Credential (r-addr)
  const [settleAddr, setSettleAddr] = useState<string>(""); // EVM settlement (0x)
  const [busy, setBusy] = useState<string>("");
  const [txHash, setTxHash] = useState<string>("");
  const [notice, setNotice] = useState<string>("");

  const xrplValid = useMemo(() => xrplAddr.trim() ? isXrplClassic(xrplAddr) : false, [xrplAddr]);
  const settleValidEvm = useMemo(() => settleAddr.trim() ? isAddress(settleAddr) : false, [settleAddr]);

  // if same token selected, auto-switch the 'to'
  useEffect(() => {
    if (from === to) {
      const next = tokenSymbols.find((s) => s !== from) || tokenSymbols[0];
      setTo(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  const fromToken = TOKENS[from];
  const toToken = TOKENS[to];

  const parsedAmount = useMemo(() => {
    try {
      return amount ? parseUnits(amount, fromToken.decimals) : 0n;
    } catch {
      return 0n;
    }
  }, [amount, fromToken.decimals]);

  const estOut = useMemo(
    () => (parsedAmount ? quoteOut(parsedAmount, from, to) : 0n),
    [parsedAmount, from, to]
  );

  async function ensureAllowance(spender: Address, needed: bigint) {
    if (!address || !publicClient || !walletClient) throw new Error("Wallet not connected");

    const current: bigint = await publicClient.readContract({
      address: fromToken.address,
      abi: erc20Abi,
      functionName: "allowance",
      args: [address as Address, spender],
    });
    if (current >= needed) return;

    setBusy("Approving...");
    const hash = await walletClient.writeContract({
      address: fromToken.address,
      abi: erc20Abi,
      functionName: "approve",
      args: [spender, needed],
    });
    await publicClient.waitForTransactionReceipt({ hash });
  }

  function buildSwapCalldata(toAddr: Address, minOut: bigint): EncodedCall {
    if (!ROUTER_ADDRESS) throw new Error("Router not set: NEXT_PUBLIC_ROUTER");
    return encodeFunctionData({
      abi: routerAbi,
      functionName: "swapExactIn",
      args: [fromToken.address, toToken.address, parsedAmount, minOut, toAddr],
    }) as EncodedCall;
  }

  async function onSwap() {
    try {
      setNotice("");
      setTxHash("");

      if (!parsedAmount || parsedAmount <= 0n) throw new Error("Enter amount");
      if (!ROUTER_ADDRESS) throw new Error("Router not set: NEXT_PUBLIC_ROUTER");
      if (!walletClient || !publicClient) throw new Error("No wallet client");

      // 1) compute minOut by slippage
      const uIn = BigInt(UNIT_PER_USD[from]);
      const uOut = BigInt(UNIT_PER_USD[to]);
      const est = (parsedAmount * uOut) / uIn;
      const bps = BigInt(Math.round((parseFloat(slippage || "0.5")) * 100)); // 0.5% -> 50 bps
      const minOut = (est * (10000n - bps)) / 10000n;

      // ===== Mode A: Credential Batch (xrpl r-addr provided) =====
      if (xrplAddr.trim()) {
        if (!isXrplClassic(xrplAddr)) throw new Error("Invalid XRPL (r...) address");
        const toAddr: Address = (settleValidEvm ? (settleAddr as Address) : (address as Address));

        // (client safety) make sure allowance is in place for router (so relayer call won't fail on allowance)
        await ensureAllowance(ROUTER_ADDRESS, parsedAmount);

        // 준비: swap calldata
        const swapCalldata = buildSwapCalldata(toAddr, minOut);

        // 배치 의도:
        //  - Step1: CredentialVerifier가 r-addr을 검사하고, 정해진 정책(해당 0x 소유/연계, KYC 등) 미충족 시 revert
        //  - Step2: Router.swapExactIn 실행
        //  - 토큰/승인/잔액 부족 시 swap에서 revert → 전체 배치 revert (원자성)
        // 서버(relay)로 아래 payload를 넘기면, 서버가 온체인 batch/multicall로 한 번에 보냄
        setBusy("Submitting batch (Credential + Swap)...");
        const res = await fetch(`${RELAY_URL}/batch`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {}),
          },
          body: JSON.stringify({
            xrplAddress: xrplAddr.trim(),              // credential subject
            evmSettlement: toAddr,                     // receive address (0x)
            router: ROUTER_ADDRESS,                    // router used inside batch
            tokenIn: fromToken.address,
            tokenOut: toToken.address,
            amountIn: parsedAmount.toString(),
            minAmountOut: minOut.toString(),
            calls: [
              // 서버가 자체적으로 CredentialVerifier.encodeCall(...)을 구성할 수도 있고,
              // 필요 시 프론트에서 준비해 전달하는 형태도 가능.
              // 여기서는 swap만 직접 전달하고, credential 검증 call은 서버에서 prepend한다고 가정.
              {
                to: ROUTER_ADDRESS,
                data: swapCalldata,
              },
            ],
            atomic: true, // 전체 원자성 보장 (하나라도 실패하면 revert)
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Batch relay failed");
        setTxHash(data.txHash || "");
        setBusy("");
        setNotice("Batch submitted. Waiting for on-chain execution…");
        return;
      }

      // ===== Mode B: Direct EVM swap (no credential) =====
      // settleAddr가 있으면 그걸, 없으면 연결지갑으로.
      const toAddr: Address = (settleValidEvm ? (settleAddr as Address) : (address as Address));
      if (!toAddr) throw new Error("No settlement address (connect wallet or enter 0x…)");

      // allowance 체크
      await ensureAllowance(ROUTER_ADDRESS, parsedAmount);

      setBusy("Swapping...");
      const hash = await walletClient.writeContract({
        address: ROUTER_ADDRESS,
        abi: routerAbi,
        functionName: "swapExactIn",
        args: [fromToken.address, toToken.address, parsedAmount, minOut, toAddr],
      });
      setTxHash(hash);
      await publicClient.waitForTransactionReceipt({ hash });
      setBusy("");
      setNotice("Swap success ✅");
    } catch (e: any) {
      setBusy("");
      setNotice(e?.shortMessage || e?.message || String(e));
    }
  }

  return (
    <div className="min-h-[70vh] w-full flex items-start justify-center py-16">
      <div className="w-full max-w-xl rounded-2xl p-6 shadow-lg bg-[#0b1220] border border-white/10">
        <h1 className="text-2xl font-semibold mb-4">Transfer</h1>
        {/* <p className="text-sm text-white/60 mb-4">
          Swap via HotWallet Router, or run a single atomic batch with XRPL-Credential (r-address) → Swap → Settlement.
        </p> */}

        {!ROUTER_ADDRESS && (
          <div className="mb-4 text-amber-300 text-sm bg-amber-500/10 border border-amber-500/30 px-3 py-2 rounded-xl">
            Router not set. Add <code className="px-1 bg-black/30 rounded">NEXT_PUBLIC_ROUTER</code> to <code className="px-1 bg-black/30 rounded">.env.local</code>.
          </div>
        )}
        {ROUTER_ADDRESS && <div className="mb-4 text-xs text-white/50">Router: {ROUTER_ADDRESS}</div>}

        <div className="grid grid-cols-1 gap-4">
          {/* From */}
          <div className="rounded-xl p-4 bg-white/5">
            <label className="text-sm text-white/70">You pay</label>
            <div className="mt-2 flex gap-3 items-center">
              <select
                className="px-3 py-2 rounded-xl bg-white text-black outline-none"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              >
                {tokenSymbols.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <input
                className="flex-1 px-3 py-2 rounded-xl bg-white/10 outline-none"
                placeholder="0.0"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>

          {/* To */}
          <div className="rounded-xl p-4 bg-white/5">
            <label className="text-sm text-white/70">You receive</label>
            <div className="mt-2 flex gap-3 items-center">
              <select
                className="px-3 py-2 rounded-xl bg-white text-black outline-none"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              >
                {tokenSymbols.filter((s) => s !== from).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>

              <div className="flex-1">
                <div className="px-3 py-2 rounded-xl bg-white/10 text-white/80">
                  {estOut ? formatUnits(estOut, toToken.decimals) : "0.0"}
                </div>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between text-xs text-white/60">
              <span>Rate (oracle): 1 {from} ≈ {(UNIT_PER_USD[to] / UNIT_PER_USD[from]).toLocaleString()} {to}</span>
              <span className="flex items-center gap-2">
                Slippage %
                <input
                  className="w-16 px-2 py-1 rounded-lg bg-white/10 text-white outline-none"
                  value={slippage}
                  onChange={(e) => setSlippage(e.target.value)}
                />
              </span>
            </div>
          </div>

          {/* XRPL Credential (r...) */}
          <div className="rounded-xl p-4 bg-white/5">
            <label className="text-sm text-white/70">Credential (XRPL r-address)</label>
            <input
              className={`mt-2 w-full px-3 py-2 rounded-xl bg-white/10 outline-none ${
                xrplAddr && !xrplValid ? "ring-2 ring-red-500" : ""
              }`}
              placeholder="r................................"
              value={xrplAddr}
              onChange={(e) => setXrplAddr(e.target.value)}
            />
            <div className="mt-2 text-xs">
              {xrplAddr ? (
                xrplValid ? (
                  <span className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300">
                    Batch mode (Credential → Swap → Settlement)
                  </span>
                ) : (
                  <span className="px-2 py-1 rounded-lg bg-red-500/20 text-red-300">
                    Invalid r-address
                  </span>
                )
              ) : (
                <span className="text-white/50">Leave empty for direct EVM swap</span>
              )}
            </div>
          </div>

          {/* Settlement (0x...) */}
          <div className="rounded-xl p-4 bg-white/5">
            <label className="text-sm text-white/70">Settlement (EVM 0x…)</label>
            <input
              className={`mt-2 w-full px-3 py-2 rounded-xl bg-white/10 outline-none ${
                settleAddr && !settleValidEvm ? "ring-2 ring-red-500" : ""
              }`}
              placeholder="0x........................................"
              value={settleAddr}
              onChange={(e) => setSettleAddr(e.target.value)}
            />
            <div className="mt-2 text-xs text-white/50">
              Empty → your connected wallet.
            </div>
          </div>

          {/* Action */}
          <button
            onClick={onSwap}
            disabled={!amount || parsedAmount === 0n || busy !== "" || (xrplAddr && !xrplValid) || (settleAddr && !settleValidEvm)}
            className="mt-2 w-full py-3 rounded-2xl bg-emerald-500/90 hover:bg-emerald-400 disabled:opacity-50"
          >
            {busy ? busy : (xrplAddr ? `Batch: ${from} → ${to}` : `Swap ${from} → ${to}`)}
          </button>

          {!!notice && (
            <div className="text-xs text-white/70 mt-2">{notice}</div>
          )}

          {txHash && (
            <a
              className="text-xs text-emerald-300 underline mt-2"
              href={`#/tx/${txHash}`}
              target="_blank"
            >
              View tx: {txHash}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
