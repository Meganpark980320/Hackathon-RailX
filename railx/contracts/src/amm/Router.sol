// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

interface IFactoryLike {
    function getPool(bytes32 key) external view returns (address);
    function createPool(
        address tokenA,
        address tokenB,
        bool isStable
    ) external returns (address);
    function stableFeeBps() external view returns (uint16);
    function volatileFeeBps() external view returns (uint16);
}
interface IPoolLike {
    function token0() external view returns (address);
    function token1() external view returns (address);
    function isStable() external view returns (bool);
    function addLiquidity(
        uint amount0Desired,
        uint amount1Desired,
        address to
    ) external returns (uint shares, uint used0, uint used1);
    function removeLiquidity(
        uint shares,
        address to
    ) external returns (uint amount0, uint amount1);
    function getAmountOut(
        address tokenIn,
        uint amountIn
    ) external view returns (uint);
    function swapExactIn(
        address tokenIn,
        uint amountIn,
        address to,
        uint minOut
    ) external returns (uint amountOut);
}

contract Router {
    address public immutable factory;
    address public immutable hub; // e.g., USDC hub

    constructor(address _factory, address _hub) {
        factory = _factory;
        hub = _hub;
    }

    function _key(
        address a,
        address b,
        bool s
    ) internal pure returns (bytes32) {
        (address t0, address t1) = a < b ? (a, b) : (b, a);
        return keccak256(abi.encodePacked(t0, t1, s));
    }

    function _pool(
        address a,
        address b,
        bool s
    ) internal view returns (address p) {
        p = IFactoryLike(factory).getPool(_key(a, b, s));
    }

    // ------- LP UX -------
    // 기존 addLiquidity: (사용자 → Pool) 전송 ❌
    // 수정: (사용자 → Router) pull → Router가 Pool에 approve → Pool.addLiquidity()

    function addLiquidity(
        address tokenA,
        address tokenB,
        bool isStable,
        uint amountA,
        uint amountB,
        address to
    ) external returns (address pool, uint shares, uint usedA, uint usedB) {
        pool = _pool(tokenA, tokenB, isStable);
        if (pool == address(0)) {
            pool = IFactoryLike(factory).createPool(tokenA, tokenB, isStable);
        }
        (address t0, address t1) = tokenA < tokenB
            ? (tokenA, tokenB)
            : (tokenB, tokenA);
        (uint a0, uint a1) = tokenA < tokenB
            ? (amountA, amountB)
            : (amountB, amountA);

        // 사용자 → Router
        require(
            IERC20(t0).transferFrom(msg.sender, address(this), a0),
            "pull0"
        );
        require(
            IERC20(t1).transferFrom(msg.sender, address(this), a1),
            "pull1"
        );

        // Router → Pool (풀에서 transferFrom 하도록 approve)
        require(IERC20(t0).approve(pool, a0), "approve0");
        require(IERC20(t1).approve(pool, a1), "approve1");

        (shares, usedA, usedB) = IPoolLike(pool).addLiquidity(a0, a1, to);
        if (tokenA > tokenB) {
            (usedA, usedB) = (usedB, usedA);
        }
    }

    function removeLiquidity(
        address tokenA,
        address tokenB,
        bool isStable,
        uint shares,
        address to
    ) external returns (uint amtA, uint amtB) {
        address pool = _pool(tokenA, tokenB, isStable);
        require(pool != address(0), "no pool");
        (address t0, address t1) = tokenA < tokenB
            ? (tokenA, tokenB)
            : (tokenB, tokenA);
        (uint a0, uint a1) = IPoolLike(pool).removeLiquidity(shares, to);
        (amtA, amtB) = tokenA < tokenB ? (a0, a1) : (a1, a0);
    }

    // ------- Swap with USDC hub fallback -------
    // 기존 swap: (사용자 → Pool) 전송 ❌
    // 수정: (사용자 → Router) pull → Router가 Pool에 approve → Pool.swapExactIn()

    function swapExactTokensForTokens(
        address tokenIn,
        address tokenOut,
        uint amountIn,
        uint minOut,
        bool preferStable,
        address to
    ) external returns (uint amountOut) {
        address pStable = _pool(tokenIn, tokenOut, true);
        address pVol = _pool(tokenIn, tokenOut, false);

        // 공통: 사용자 → Router 로 먼저 당김
        require(
            IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn),
            "pull in"
        );

        if (preferStable && pStable != address(0)) {
            require(
                IERC20(tokenIn).approve(pStable, amountIn),
                "approve pStable"
            );
            amountOut = IPoolLike(pStable).swapExactIn(
                tokenIn,
                amountIn,
                to,
                minOut
            );
            return amountOut;
        }
        if (pVol != address(0)) {
            require(IERC20(tokenIn).approve(pVol, amountIn), "approve pVol");
            amountOut = IPoolLike(pVol).swapExactIn(
                tokenIn,
                amountIn,
                to,
                minOut
            );
            return amountOut;
        }

        // 2-홉 (tokenIn->hub, hub->tokenOut)
        require(
            hub != address(0) && tokenIn != hub && tokenOut != hub,
            "no route"
        );
        address p1s = _pool(tokenIn, hub, true);
        address p1v = _pool(tokenIn, hub, false);
        address p2s = _pool(hub, tokenOut, true);
        address p2v = _pool(hub, tokenOut, false);

        address p1 = preferStable && p1s != address(0)
            ? p1s
            : (p1v != address(0) ? p1v : address(0));
        address p2 = preferStable && p2s != address(0)
            ? p2s
            : (p2v != address(0) ? p2v : address(0));
        require(p1 != address(0) && p2 != address(0), "no 2hop");

        // hop1: Router 보유 토큰을 p1이 가져가도록 승인
        require(IERC20(tokenIn).approve(p1, amountIn), "approve p1");
        uint midOut = IPoolLike(p1).swapExactIn(
            tokenIn,
            amountIn,
            address(this),
            0
        ); // hub 받음

        // hop2: Router 보유 hub 를 p2가 가져가도록 승인
        require(IERC20(hub).approve(p2, midOut), "approve p2");
        amountOut = IPoolLike(p2).swapExactIn(hub, midOut, to, minOut);
    }

    function _pull(
        address token,
        address from,
        address toPool,
        uint amount
    ) internal {
        require(IERC20(token).transferFrom(from, toPool, amount), "pull fail");
    }
}
