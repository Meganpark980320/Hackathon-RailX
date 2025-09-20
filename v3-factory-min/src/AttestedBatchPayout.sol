// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

interface IHotWalletRouter {
    function withdraw(address token, address to, uint256 amount) external;
    function owner() external view returns (address);
}

import "@oz-v5/contracts/access/Ownable.sol";
import "@oz-v5/contracts/utils/cryptography/ECDSA.sol";
import "@oz-v5/contracts/utils/cryptography/EIP712.sol";

contract AttestedBatchPayout is Ownable, EIP712 {
    using ECDSA for bytes32;

    // 신뢰하는 검증자(게이트웨이) 지갑
    address public trustedSigner;

    // 리플레이 방지를 위한 사용표시
    mapping(bytes32 => bool) public usedKeys;      // (해시 키)
    mapping(bytes32 => bool) public usedXrplTx;    // XRPL txhash 단위로도 1회 제한 원하면 사용

    // EIP-712 타입해시
    bytes32 private constant PAYOUT_TYPEHASH = keccak256(
        "Payout(address router,address token,address to,uint256 amount,bytes32 xrplTxHash,uint256 deadline,uint256 nonce)"
    );

    struct Item {
        address router;        // HotWalletRouter 주소
        address token;         // 지급 토큰
        address to;            // 수령자
        uint256 amount;        // 지급 수량 (wei)
        bytes32 xrplTxHash;    // XRPL 결제 tx hash (32바이트로 가공)
        uint256 deadline;      // 만료시간 (unix)
        uint256 nonce;         // 고유값
        bytes   signature;     // trustedSigner의 EIP-712 서명
    }

    constructor(address initialOwner, address _trustedSigner)
        Ownable(initialOwner)
        EIP712("RailX", "1")
    {
        trustedSigner = _trustedSigner;
    }

    function setTrustedSigner(address s) external onlyOwner {
        trustedSigner = s;
    }

    function _hashItem(Item calldata it) internal view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                PAYOUT_TYPEHASH,
                it.router,
                it.token,
                it.to,
                it.amount,
                it.xrplTxHash,
                it.deadline,
                it.nonce
            )
        );
        return _hashTypedDataV4(structHash);
    }

    function process(Item[] calldata items) external onlyOwner {
        uint256 n = items.length;
        for (uint256 i = 0; i < n; i++) {
            Item calldata it = items[i];

            require(block.timestamp <= it.deadline, "expired");
            require(IHotWalletRouter(it.router).owner() == address(this), "not router owner");

            // 리플레이 키: (router,token,to,amount,xrplTxHash,deadline,nonce,chainId,contract) 포함된 EIP712 digest 자체로 사용
            bytes32 digest = _hashItem(it);
            require(!usedKeys[digest], "already used");
            // XRPL 트랜잭션도 1회만 쓰려면 활성화
            // require(!usedXrplTx[it.xrplTxHash], "xrpl used");

            address signer = ECDSA.recover(digest, it.signature);
            require(signer == trustedSigner, "bad signer");

            // 마킹
            usedKeys[digest] = true;
            // usedXrplTx[it.xrplTxHash] = true;

            // 지급 실행 (Router 핫월렛에서 사용자에게 송금)
            IHotWalletRouter(it.router).withdraw(it.token, it.to, it.amount);
        }
    }
}
