// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";

interface IPool {
    function initialize(address token0, address token1, bool isStable, uint16 feeBps, address factory) external;
}

contract Factory is Ownable {
    // 풀 키: token0 < token1 정렬 + isStable 플래그
    mapping(bytes32 => address) public getPool;
    address[] public allPools;

    // 수수료 정책 (bps: 1 = 0.01%)
    uint16 public stableFeeBps = 5;    // 0.05%
    uint16 public volatileFeeBps = 30; // 0.30%
    // 프로토콜 수수료: "스왑 수수료"의 몇 %를 프로토콜로
    // 예) 1000 = 10% (수수료의 10%)
    uint16 public protocolFeeBps = 1000;
    address public feeTo;

    event PoolCreated(
        address indexed token0,
        address indexed token1,
        bool    indexed isStable,
        address pool,
        uint16  feeBps
    );
    event FeeToSet(address indexed feeTo);
    event ProtocolFeeBpsSet(uint16 bps);
    event PoolFeeBpsSet(uint16 stableBps, uint16 volatileBps);

    constructor(address _owner) Ownable(_owner) {}

    function allPoolsLength() external view returns (uint256) {
        return allPools.length;
    }

    function setFeeTo(address _feeTo) external onlyOwner {
        feeTo = _feeTo;
        emit FeeToSet(_feeTo);
    }

    function setProtocolFeeBps(uint16 _bps) external onlyOwner {
        require(_bps <= 5000, "protocol bps too high"); // 프로토콜이 수수료의 50% 이상 가져가지 않도록 안전장치
        protocolFeeBps = _bps;
        emit ProtocolFeeBpsSet(_bps);
    }

    function setPoolFeeBps(uint16 _stableBps, uint16 _volatileBps) external onlyOwner {
        require(_stableBps <= 1000 && _volatileBps <= 1000, "pool bps too high");
        stableFeeBps = _stableBps;
        volatileFeeBps = _volatileBps;
        emit PoolFeeBpsSet(_stableBps, _volatileBps);
    }

    /// @notice 누구나 풀 생성
    function createPool(address tokenA, address tokenB, bool isStable, address poolImplementation) external returns (address pool) {
        require(tokenA != tokenB, "identical");
        (address token0, address token1) = _sortTokens(tokenA, tokenB);
        bytes32 key = _poolKey(token0, token1, isStable);
        require(getPool[key] == address(0), "exists");
        require(poolImplementation != address(0), "impl=0");

        // 최소 기능을 가진 풀 구현 컨트랙트를 직접 배포하는 방식(업그레이드 필요 없고 간단함)
        // 구현 컨트랙트 주소로부터 새로운 인스턴스를 만들려면 일반적으로 clone을 쓰지만,
        // 여기서는 데모 간소화를 위해 "구현 주소를 그대로" 새 컨트랙트로 배포하도록 가정합니다.
        // => 실전에서는 Minimal Proxy(ERC-1167) 혹은 직접 new 풀 컨트랙트를 권장.
        // 이번 데모에서는 poolImplementation을 "새 풀을 배포할 코드"로 쓰는 대신,
        // poolImplementation이 "풀 로직을 가진 배포용 컨트랙트"라고 가정하고 new 호출로 생성합니다.

        // NOTE: 풀 구현을 Volatile/Stable 별도로 마련한다고 가정:
        // - isStable == false -> VolatilePool
        // - isStable == true  -> StablePool
        // 아래 new 호출은 각각의 풀 소스에서 constructor 없는 패턴을 쓰고, initialize로 설정을 마칩니다.
        assembly {
            let ptr := mload(0x40)
            // create(v, p, n) — zero value, no init code in memory (we can’t in pure Yul)
            // 여기서는 new <Contract>()를 솔리디티로 호출하기 위해 아래로 우회하지 않고,
            // 솔리디티에서 생성하도록 하겠습니다 (아래로 내려가 초기화 호출).
        }
        // Solidity new 사용 (poolImplementation을 직접 new 할 수 없으므로, isStable 분기에 따라 각 풀 new)
        if (isStable) {
            pool = address(new StablePoolMinimal());
        } else {
            pool = address(new VolatilePoolMinimal());
        }

        IPool(pool).initialize(token0, token1, isStable, _feeBps(isStable), address(this));

        getPool[key] = pool;
        allPools.push(pool);

        emit PoolCreated(token0, token1, isStable, pool, _feeBps(isStable));
    }

    function _feeBps(bool isStable) internal view returns (uint16) {
        return isStable ? stableFeeBps : volatileFeeBps;
    }

    function _sortTokens(address a, address b) internal pure returns (address, address) {
        return (a < b) ? (a, b) : (b, a);
    }

    function _poolKey(address token0, address token1, bool isStable) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(token0, token1, isStable));
    }
}

/* ====== 최소 더미 풀 (컴파일을 위한 스텁) ======
   다음 단계에서 실제 Volatile/Stable 풀을
   각각 별도 파일(VolatilePool.sol / StablePool.sol)로 교체/확장할 예정입니다.
*/
contract VolatilePoolMinimal is IPool {
    address public factory;
    address public token0;
    address public token1;
    bool    public isStable;
    uint16  public feeBps;

    function initialize(address _t0, address _t1, bool _isStable, uint16 _feeBps, address _factory) external {
        require(factory == address(0), "inited");
        factory = _factory;
        token0 = _t0;
        token1 = _t1;
        isStable = _isStable;
        feeBps = _feeBps;
    }
}

contract StablePoolMinimal is IPool {
    address public factory;
    address public token0;
    address public token1;
    bool    public isStable;
    uint16  public feeBps;

    function initialize(address _t0, address _t1, bool _isStable, uint16 _feeBps, address _factory) external {
        require(factory == address(0), "inited");
        factory = _factory;
        token0 = _t0;
        token1 = _t1;
        isStable = _isStable;
        feeBps = _feeBps;
    }
}
