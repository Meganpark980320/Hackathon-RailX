# RailX (XRPL EVM 해커톤 프로토타입)

**XRPL EVM Testnet (체인 ID: `1449000`)** 기반으로 구축된 크로스보더 DeFi 프로토타입입니다.  

구현된 주요 기능:

- **Uniswap v3 스타일 집중 유동성 풀**
- **Stable–Stable / XRP–Stable 스왑**
- **크로스체인 브릿지 플로우 (Axelar, Escrow)**
- **KYC/기관용 결제(데모에서는 스텁 처리)**

---

## 🌐 아키텍처

XRPL (L1) ←→ XRPL EVM (L2/사이드체인) ←→ 외부 체인(Ethereum 등)
│ │
│ ├─ Uniswap v3 Factory
│ ├─ NonfungiblePositionManager (NPM)
│ ├─ SwapRouter
│ └─ Escrow / Batch (계획 중)
│
└─ KYC 어테스테이션 (향후 ZK 기반 업그레이드 예정)

---

## ⚙️ 기술 스택

- **스마트 컨트랙트**: Solidity, Foundry  
  - `UniswapV3Factory`, `NonfungiblePositionManager`, `SwapRouter`
- **프론트엔드**: Next.js 15, TypeScript, Wagmi + Viem, Tailwind
- **인프라**: XRPL EVM RPC ([testnet](https://rpc.testnet.xrplevm.org)), QuickNode
- **도구**: Forge, Cast, pnpm, Vercel

---

## 🚀 로컬 실행 방법

### 1. 패키지 설치

```bash
pnpm install
```


### 2. 환경 변수 설정
.env.sample을 복사해 .env 작성:

```bash
FACT=0x5A55c476feA68F487Bd6B4a72B749590b4a84f33
WXRP=0xFc1Ad88A70C0922F1cf0eCd2D0AcDa0DDecCFfd8
NPM=0x99771458583aC4be7cDDc2229E6f45c75861c89d

POOL_INIT_CODE_HASH=0xf7bb259e88c32be0c7d67813f9d75c4307dccd6a273848af69e93f1a6af7ede1
```

### 3. 컨트랙트 배포
```bash

forge script script/DeployAll.s.sol \
  --rpc-url $NEXT_PUBLIC_RPC_URL \
  --broadcast \
  --private-key $PRIVATE_KEY
```
### 4. 프론트엔드 실행
```bash

pnpm dev
```

## 🧩 데모 시나리오
풀 생성: USDT/USDC, XRP/USDC 풀 초기화

유동성 공급: NPM으로 LP NFT 민팅

스왑 실행: SwapRouter를 통한 토큰 교환

크로스체인 Escrow (스텁): Batch/기관용 결제 흐름 시뮬레이션


## 📅 해커톤 범위 (MVP)
Stable–Stable / XRP–Stable 스왑 (최소 2개 풀 구동)

## 📜 참고사항

```bash
OWNER_ADDRESS=0xa27A39Cec16d936468dc29d504D1BCaf09472656
SIGNER_ADDRESS=0x791e719e87B5eF4393316091Dfa6826DdC025711

ADDRESS_ISSUER=r46VPv5eeYLztzSumdoMUFGZZGEWnVHF7N
ADDRESS_SUBJECT=rJDMHE4Xf7TQ55fixYVYQeNSBwVZbS4vRx
```


## 디렉토리 구조:

```bash

/contracts   # Foundry 컨트랙트
/frontend    # Next.js 프론트엔드

```
🛠️ 로드맵
✅ XRPL EVM에서 Uniswap v3 배포

✅ 기본 스왑 & 유동성 UI

🔲 Axelar 브릿지 데모

🔲 ZK 어테스테이션

🔲 메인넷 배포
