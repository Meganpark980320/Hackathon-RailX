<img width="1399" height="634" alt="image" src="https://github.com/user-attachments/assets/45dbeb3f-e8f6-4709-9ca1-01f347f188fe" /># RailX (XRPL EVM 해커톤 프로토타입)

**XRPL EVM Testnet (체인 ID: `1449000`)** 기반으로 구축된 크로스보더 DeFi 프로토타입입니다.  

구현된 주요 기능:

- **Uniswap v3 스타일 집중 유동성 풀**
- **크로스체인 브릿지 플로우 (Axelar, Escrow)**

---

## 🌐 아키텍처
<img width="1399" height="634" alt="스크린샷 2025-09-21 082413" src="https://github.com/user-attachments/assets/fe671193-5490-4c63-963a-36805415d7f6" />

---

## ⚙️ 기술 스택

- **스마트 컨트랙트**: Solidity, Foundry  
  - `UniswapV3Factory`, `NonfungiblePositionManager`, `SwapRouter`
- **프론트엔드**: Next.js 15, TypeScript, Wagmi + Viem, Tailwind
- **인프라**: XRPL EVM RPC ([testnet](https://rpc.testnet.xrplevm.org)), QuickNode
- **도구**: Forge, Cast, pnpm

- 

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



## 📜 참고 주소

```bash
OWNER_ADDRESS=0xa27A39Cec16d936468dc29d504D1BCaf09472656
SIGNER_ADDRESS=0x791e719e87B5eF4393316091Dfa6826DdC025711

ADDRESS_ISSUER=r46VPv5eeYLztzSumdoMUFGZZGEWnVHF7N
ADDRESS_SUBJECT=rJDMHE4Xf7TQ55fixYVYQeNSBwVZbS4vRx
```


## 디렉토리 구조:

```bash

/frontend    # Next.js 프론트엔드
/v3-factory-min   # Foundry 컨트랙트


```
## 🛠️ 로드맵

T+1~2: JPYC, XSGD 풀 확대, LP 인센티브 실험, OOBank, KRWK-RailX 해외 송금 PoC 수행
T+3~4: 국내 3개 은행과 추가로 RailX 기반 해외 송금 PoC, Ripple과 RLUSD 유동성 공급 계약
T+6: Delta-Neutral Vault 알파, 오라클/리스크 엔진 고도화, 내부/외부 보안 Audit 리포팅, 기존 LP 파트너(Amber, DWF)와 유동성 공급 계약
T+9~12: 2차 스마트 컨트랙트 Audit, 상용화

https://github.com/user-attachments/assets/85cc6998-7aa8-4d72-8d7b-c6c9d8d2c6be

