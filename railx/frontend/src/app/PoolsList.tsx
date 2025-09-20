"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createPublicClient,
  http,
  zeroAddress,
  Hex,
  Address as ViemAddress,
} from "viem";
import {
  CHAIN_ID,
  RPC_URL,
  FACTORY_ADDRESS,
  FACTORY_DEPLOY_BLOCK,
  erc20Abi,
} from "@/lib/config";

const client = createPublicClient({
  chain: {
    id: CHAIN_ID,
    name: "XRPL EVM Testnet",
    nativeCurrency: { name: "XRP", symbol: "XRP", decimals: 18 },
    rpcUrls: { default: { http: [RPC_URL] } },
  },
  transport: http(RPC_URL),
});

// XRPL EVM 실제 PoolCreated topic0 (네 영수증 기준)
const POOL_CREATED_TOPIC =
  "0x783cca1c0412dd0d695e784568c96da2e9c22ff989357a2e8b1d9b2b4e6b7118" as Hex;

type PoolRow = {
  pool: `0x${string}`;
  token0: `0x${string}`;
  token1: `0x${string}`;
  fee: number;
  tickSpacing: number;
};

type TokenMeta = { symbol?: string; decimals?: number };
type PoolBalances = { bal0?: bigint; bal1?: bigint };

function addrFromTopic(t: string) {
  return (`0x${t.slice(-40)}`) as `0x${string}`;
}
function toSignedInt24FromWord(wordHex: string) {
  const bi = BigInt(wordHex);
  const mask = 1n << 23n;
  let val = bi & ((1n << 24n) - 1n);
  if (val & mask) val = val - (1n << 24n);
  return Number(val);
}
function parsePoolCreatedLog(log: { topics: Hex[]; data: Hex }): PoolRow | null {
  try {
    const [topic0, tToken0, tToken1, tFee] = log.topics;
    if (topic0 !== POOL_CREATED_TOPIC) return null;

    const token0 = addrFromTopic(tToken0);
    const token1 = addrFromTopic(tToken1);
    const fee = Number(BigInt(tFee)); // uint24

    const dataNo0x = log.data.slice(2);
    const w1 = "0x" + dataNo0x.slice(0, 64);
    const w2 = "0x" + dataNo0x.slice(64, 128);
    const tickSpacing = toSignedInt24FromWord(w1);
    const pool = (("0x" + w2.slice(-40)) as `0x${string}`);

    if (pool === zeroAddress || token0 === zeroAddress || token1 === zeroAddress) return null;
    return { pool, token0, token1, fee, tickSpacing };
  } catch {
    return null;
  }
}

function short(addr: string) {
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

// bytes32 심볼 fallback
const erc20Bytes32SymbolAbi = [
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "bytes32" }] },
] as const;

async function fetchTokenMeta(address: `0x${string}`): Promise<TokenMeta> {
  let symbol: string | undefined;

  // symbol(string)
  try {
    symbol = (await client.readContract({
      address: address as ViemAddress,
      abi: erc20Abi,
      functionName: "symbol",
    })) as unknown as string;
  } catch {
    // symbol(bytes32)
    try {
      const raw = (await client.readContract({
        address: address as ViemAddress,
        abi: erc20Bytes32SymbolAbi,
        functionName: "symbol",
      })) as unknown as `0x${string}`;
      const hex = raw.replace(/^0x/, "");
      const buf = Buffer.from(hex, "hex");
      symbol = buf.toString("utf8").replace(/\u0000+$/, "") || undefined;
    } catch {
      symbol = undefined;
    }
  }

  let decimals: number | undefined;
  try {
    decimals = Number(
      await client.readContract({
        address: address as ViemAddress,
        abi: erc20Abi,
        functionName: "decimals",
      })
    );
  } catch {
    decimals = undefined;
  }

  return { symbol, decimals };
}

async function fetchPoolBalances(pool: `0x${string}`, token0: `0x${string}`, token1: `0x${string}`): Promise<PoolBalances> {
  // balanceOf(token, pool)
  const [b0, b1] = await Promise.all([
    client.readContract({
      address: token0 as ViemAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [pool],
    }).then((x) => x as unknown as bigint).catch(() => undefined),
    client.readContract({
      address: token1 as ViemAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [pool],
    }).then((x) => x as unknown as bigint).catch(() => undefined),
  ]);

  return { bal0: b0, bal1: b1 };
}

function fmtAmount(raw?: bigint, decimals?: number, max = 6) {
  if (raw === undefined || decimals === undefined) return "-";
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const frac = raw % base;
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, Math.max(0, max));
  return fracStr.length ? `${whole.toString()}.${fracStr}` : whole.toString();
}

export default function PoolsList() {
  const [rows, setRows] = useState<PoolRow[]>([]);
  const [symbols, setSymbols] = useState<Record<string, TokenMeta>>({});
  const [balances, setBalances] = useState<Record<string, PoolBalances>>({});
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("");

  const decorated = useMemo(
    () =>
      rows.map((r) => {
        const key = r.pool.toLowerCase();
        const m0 = symbols[r.token0.toLowerCase()];
        const m1 = symbols[r.token1.toLowerCase()];
        const bal = balances[key] || {};
        return {
          ...r,
          sym0: m0?.symbol,
          sym1: m1?.symbol,
          dec0: m0?.decimals,
          dec1: m1?.decimals,
          bal0: bal.bal0,
          bal1: bal.bal1,
        };
      }),
    [rows, symbols, balances]
  );

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        setRows([]);
        setSymbols({});
        setBalances({});
        setProgress("scanning pools…");

        const latest = await client.getBlockNumber();

        // 1) 풀 찾기
        const logs = await client.getLogs({
          address: FACTORY_ADDRESS,
          topics: [POOL_CREATED_TOPIC],
          fromBlock: FACTORY_DEPLOY_BLOCK,
          toBlock: latest,
        });

        const items = logs
          .map((l) => parsePoolCreatedLog({ topics: l.topics as Hex[], data: l.data as Hex }))
          .filter(Boolean) as PoolRow[];

        setRows(items.slice().reverse());
        setProgress(`found ${items.length} pools — fetching token metas…`);

        // 2) 토큰 메타
        const uniqTokens = Array.from(new Set(items.flatMap((x) => [x.token0, x.token1]).map((a) => a.toLowerCase()))) as `0x${string}`[];
        const metas = await Promise.all(uniqTokens.map((addr) => fetchTokenMeta(addr)));
        const metaMap: Record<string, TokenMeta> = {};
        uniqTokens.forEach((addr, i) => (metaMap[addr] = metas[i]));
        setSymbols(metaMap);

        // 3) 풀 잔고 (각 풀당 2회 호출)
        setProgress(`fetching balances…`);
        const entries = await Promise.all(
          items.map(async (p) => {
            const b = await fetchPoolBalances(p.pool, p.token0, p.token1);
            return [p.pool.toLowerCase(), b] as const;
          })
        );
        const balMap: Record<string, PoolBalances> = {};
        entries.forEach(([k, v]) => (balMap[k] = v));
        setBalances(balMap);

        setProgress(`done.`);
      } catch (e: any) {
        setErr(e?.message || "Failed to load pools.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div>Loading pools… <span className="text-xs opacity-70">{progress}</span></div>;
  if (err) return <div style={{ color: "tomato" }}>Error: {err}</div>;
  if (decorated.length === 0) return <div>No pools found.</div>;

  return (
    <div className="space-y-3">
      <div className="text-xs opacity-70">{progress}</div>

      {decorated.map((r) => (
        <div key={r.pool} className="rounded-xl border border-white/10 p-4 flex items-center justify-between">
          <div className="text-sm">
            <div className="font-mono">
              Pool: {r.pool}{" "}
              <span className="opacity-70">
                ({r.sym0 ?? short(r.token0)} / {r.sym1 ?? short(r.token1)})
              </span>
            </div>

            <div className="opacity-80">
              token0: {r.sym0 ?? short(r.token0)} <br />
              token1: {r.sym1 ?? short(r.token1)}
            </div>
{/* 
            <div className="mt-2">
              <div className="opacity-70 text-xs">TVL (raw balances)</div>
              <div>
                {fmtAmount(r.bal0, r.dec0)} {r.sym0 ?? short(r.token0)} +{" "}
                {fmtAmount(r.bal1, r.dec1)} {r.sym1 ?? short(r.token1)}
              </div>
            </div> */}
          </div>

          <div className="text-right text-sm">
            <div>fee: {r.fee / 1e4}%</div>
            <div>tickSpacing: {r.tickSpacing}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
