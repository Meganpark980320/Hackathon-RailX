// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

// import {ReentrancyGuard} from "openzeppelin-contracts/contracts/security/ReentrancyGuard.sol";
// import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";


interface IFactoryView {
    function feeTo() external view returns (address);
    function protocolFeeBps() external view returns (uint16);
}

contract VolatilePool is ReentrancyGuard {
    address public factory;
    address public token0;
    address public token1;
    uint112 public reserve0;
    uint112 public reserve1;
    uint32  public blockTimestampLast;
    uint16  public feeBps;          // e.g., 30 = 0.30%
    bool    public isStable;        // always false here (for UI convenience)

    // simple LP shares
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;

    event Initialize(address token0, address token1, bool isStable, uint16 feeBps, address factory);
    event Mint(address indexed sender, uint amount0, uint amount1, address indexed to, uint shares);
    event Burn(address indexed sender, address indexed to, uint shares, uint amount0, uint amount1);
    event Swap(address indexed sender, address indexed tokenIn, uint amountIn, address indexed to, uint amountOut);

    modifier onlyFactory() {
        require(msg.sender == factory, "only factory");
        _;
    }

    function initialize(address _t0, address _t1, bool _isStable, uint16 _feeBps, address _factory) external {
        require(factory == address(0), "inited");
        require(_t0 != _t1, "identical");
        token0 = _t0 < _t1 ? _t0 : _t1;
        token1 = _t0 < _t1 ? _t1 : _t0;
        isStable = _isStable; // should be false
        feeBps = _feeBps;
        factory = _factory;
        emit Initialize(token0, token1, isStable, feeBps, factory);
    }

    // ------- LP -------
    function addLiquidity(uint amount0Desired, uint amount1Desired, address to)
        external nonReentrant
        returns (uint shares, uint used0, uint used1)
    {
        require(to != address(0), "to=0");
        (uint r0, uint r1) = (reserve0, reserve1);

        if (totalSupply == 0) {
            // first mint: shares = sqrt(a*b)
            used0 = amount0Desired;
            used1 = amount1Desired;
            shares = _sqrt(used0 * used1);
        } else {
            // keep price: amount1Optimal = amount0Desired * r1 / r0
            uint amount1Optimal = (amount0Desired * r1) / r0;
            if (amount1Optimal <= amount1Desired) {
                used0 = amount0Desired;
                used1 = amount1Optimal;
            } else {
                // amount0Optimal = amount1Desired * r0 / r1
                uint amount0Optimal = (amount1Desired * r0) / r1;
                used0 = amount0Optimal;
                used1 = amount1Desired;
            }
            shares = _min((used0 * totalSupply) / r0, (used1 * totalSupply) / r1);
        }

        require(shares > 0, "shares=0");
        _pull(token0, msg.sender, used0);
        _pull(token1, msg.sender, used1);

        reserve0 = uint112(r0 + used0);
        reserve1 = uint112(r1 + used1);
        blockTimestampLast = uint32(block.timestamp);

        totalSupply += shares;
        balanceOf[to] += shares;

        emit Mint(msg.sender, used0, used1, to, shares);
    }

    function removeLiquidity(uint shares, address to)
        external nonReentrant
        returns (uint amount0, uint amount1)
    {
        require(shares > 0, "shares=0");
        require(balanceOf[msg.sender] >= shares, "insufficient shares");

        (uint r0, uint r1) = (reserve0, reserve1);
        amount0 = (r0 * shares) / totalSupply;
        amount1 = (r1 * shares) / totalSupply;

        balanceOf[msg.sender] -= shares;
        totalSupply -= shares;

        reserve0 = uint112(r0 - amount0);
        reserve1 = uint112(r1 - amount1);
        blockTimestampLast = uint32(block.timestamp);

        _push(token0, to, amount0);
        _push(token1, to, amount1);

        emit Burn(msg.sender, to, shares, amount0, amount1);
    }

    // ------- SWAP -------
    function getAmountOut(address tokenIn, uint amountIn) public view returns (uint amountOut) {
        require(amountIn > 0, "amountIn=0");
        (uint rIn, uint rOut, uint16 _fee) = tokenIn == token0
            ? (reserve0, reserve1, feeBps)
            : (reserve1, reserve0, feeBps);
        uint amountInWithFee = amountIn * (10_000 - _fee) / 10_000;
        amountOut = (rOut * amountInWithFee) / (rIn + amountInWithFee);
    }

    function swapExactIn(address tokenIn, uint amountIn, address to, uint minOut) external nonReentrant returns (uint amountOut) {
        require(tokenIn == token0 || tokenIn == token1, "bad tokenIn");

        // fees
        uint fee = (amountIn * feeBps) / 10_000;
        uint16 pBps = IFactoryView(factory).protocolFeeBps();
        uint proto = (fee * pBps) / 10_000;
        address feeTo = IFactoryView(factory).feeTo();

        // pull input
        _pull(tokenIn, msg.sender, amountIn);

        // send protocol cut
        if (proto > 0 && feeTo != address(0)) {
            _push(tokenIn, feeTo, proto);
        }

        // xy=k swap with (amountIn - fee)
        uint amountInAfterFee = amountIn - fee;
        bool zeroForOne = tokenIn == token0;

        (uint rIn, uint rOut) = zeroForOne ? (reserve0, reserve1) : (reserve1, reserve0);
        amountOut = (rOut * amountInAfterFee) / (rIn + amountInAfterFee);
        require(amountOut >= minOut, "slippage");

        // update reserves
        if (zeroForOne) {
            reserve0 = uint112(rIn + amountIn);
            reserve1 = uint112(rOut - amountOut);
        } else {
            reserve1 = uint112(rIn + amountIn);
            reserve0 = uint112(rOut - amountOut);
        }
        blockTimestampLast = uint32(block.timestamp);

        // pay out
        address tokenOut = zeroForOne ? token1 : token0;
        _push(tokenOut, to, amountOut);

        emit Swap(msg.sender, tokenIn, amountIn, to, amountOut);
    }

    // ------- utils -------
    function _pull(address token, address from, uint amount) internal {
        require(IERC20(token).transferFrom(from, address(this), amount), "pull fail");
    }

    function _push(address token, address to, uint amount) internal {
        require(IERC20(token).transfer(to, amount), "push fail");
    }

    function _min(uint a, uint b) private pure returns (uint) { return a < b ? a : b; }
    function _sqrt(uint y) private pure returns (uint z) {
        if (y > 3) { z = y; uint x = y / 2 + 1; while (x < z) { z = x; x = (y / x + x) / 2; } }
        else if (y != 0) { z = 1; }
    }
}
