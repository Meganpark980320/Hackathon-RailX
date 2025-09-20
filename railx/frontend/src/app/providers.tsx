"use client";

import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { config } from "@/lib/wagmi"; // 너의 wagmi 설정 import 경로에 맞춰둬

export default function Providers({ children }: { children: React.ReactNode }) {
  // ✅ 렌더마다 새로 만들지 말고, 1회만 생성
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { refetchOnWindowFocus: false },
        },
      })
  );

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
