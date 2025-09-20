import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // Next가 파일 추적할 "워크스페이스 루트"를 명시 (여기서는 ~/projects/Hackathon)
  outputFileTracingRoot: path.join(__dirname, '../..'),
  reactStrictMode: true,
};

export default nextConfig;
