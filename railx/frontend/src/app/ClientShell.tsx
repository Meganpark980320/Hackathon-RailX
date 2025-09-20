"use client";

import dynamic from "next/dynamic";

const WalletButtons = dynamic(() => import("../components/WalletButtons"), { ssr: false });
const CreatePoolCard = dynamic(() => import("./CreatePoolCard"), { ssr: false });
const PoolsList = dynamic(() => import("../app/PoolsList"), { ssr: false });
const AddLiquidityCard = dynamic(() => import("./AddLiquidityCard"), { ssr: false });
const FactoryInfo = dynamic(() => import("./FactoryInfo"), { ssr: false });
const EnableAllFees = dynamic(() => import("./EnableAllFees"), { ssr: false });

export default function ClientShell() {
  return (
    <main className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Pools</h1>
          <p className="text-neutral-400">Create & initialize a new pool.</p>
        </div>
        <WalletButtons />
      </div>
      <CreatePoolCard />
      <PoolsList />
      <AddLiquidityCard />
      {/* <FactoryInfo /> */}
      {/* <EnableAllFees /> */}
    </main>
  );
}
