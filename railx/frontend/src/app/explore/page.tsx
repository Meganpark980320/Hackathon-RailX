"use client";

import dynamic from "next/dynamic";

// 네가 이미 만든 컴포넌트 재활용
const ClientShell = dynamic(() => import("../ClientShell"), { ssr: false });

export default function ExplorePage() {
  return <ClientShell />;
}
