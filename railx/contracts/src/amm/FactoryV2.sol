// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {VolatilePool} from "./VolatilePool.sol";
import {StablePool} from "./StablePool.sol";

interface IPool {
    function initialize(address token0, address token1, bool isStable, uint16 feeBps, address factory) external;
}

contract FactoryV2 is Ownable {
    mapping(bytes32 => address) public getPool;
    address[] public allPools;

    uint16 public stableFeeBps = 5;    // 0.05%
    uint16 public volatileFeeBps = 30; // 0.30%
    uint16 public protocolFeeBps = 1000; // of swap fee (10% of fee)
    address public feeTo;

    event PoolCreated(address indexed token0, address indexed token1, bool indexed isStable, address pool, uint16 feeBps);
    event FeeToSet(address indexed feeTo);
    event ProtocolFeeBpsSet(uint16 bps);
    event PoolFeeBpsSet(uint16 stableBps, uint16 volatileBps);

    constructor(address _owner) Ownable(_owner) {}

    function allPoolsLength() external view returns (uint256) { return allPools.length; }
    function setFeeTo(address _feeTo) external onlyOwner { feeTo = _feeTo; emit FeeToSet(_feeTo); }
    function setProtocolFeeBps(uint16 _bps) external onlyOwner { require(_bps<=5000,"high"); protocolFeeBps=_bps; emit ProtocolFeeBpsSet(_bps); }
    function setPoolFeeBps(uint16 _s, uint16 _v) external onlyOwner { require(_s<=1000&&_v<=1000,"high"); stableFeeBps=_s; volatileFeeBps=_v; emit PoolFeeBpsSet(_s,_v); }

    function createPool(address tokenA, address tokenB, bool isStable) external returns (address pool) {
        require(tokenA != tokenB, "identical");
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        bytes32 key = keccak256(abi.encodePacked(token0, token1, isStable));
        require(getPool[key] == address(0), "exists");

        if (isStable) pool = address(new StablePool());
        else          pool = address(new VolatilePool());

        IPool(pool).initialize(token0, token1, isStable, isStable ? stableFeeBps : volatileFeeBps, address(this));
        getPool[key] = pool;
        allPools.push(pool);

        emit PoolCreated(token0, token1, isStable, pool, isStable ? stableFeeBps : volatileFeeBps);
    }

    // view helpers for pools
    // function feeTo() external view returns (address) { return feeTo; }
    // function protocolFeeBps() external view returns (uint16) { return protocolFeeBps; }
}
