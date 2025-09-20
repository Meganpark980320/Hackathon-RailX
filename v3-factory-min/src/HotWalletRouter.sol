// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "@oz-v5/contracts/access/Ownable.sol";
import "@oz-v5/contracts/token/ERC20/utils/SafeERC20.sol";
import "@oz-v5/contracts/token/ERC20/IERC20.sol";

contract HotWalletRouter is Ownable {
    using SafeERC20 for IERC20;

    struct Price { uint256 num; uint256 den; }
    mapping(address => mapping(address => Price)) public price;

    event PriceSet(address indexed tokenIn, address indexed tokenOut, uint256 num, uint256 den);
    event PriceBatchSet(uint256 count);
    event SwapExecuted(address indexed sender, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut, address to);
    event Withdrawn(address indexed token, address indexed to, uint256 amount);

    constructor(address initialOwner) Ownable(initialOwner) {}

    function setPrice(address tokenIn, address tokenOut, uint256 num, uint256 den) external onlyOwner {
        require(tokenIn != tokenOut, "same token");
        require(den > 0, "den=0");
        price[tokenIn][tokenOut] = Price({num: num, den: den});
        emit PriceSet(tokenIn, tokenOut, num, den);
    }

    function setPricesBatch(
        address[] calldata tokenIns,
        address[] calldata tokenOuts,
        uint256[] calldata nums,
        uint256[] calldata dens
    ) external onlyOwner {
        uint256 n = tokenIns.length;
        require(n == tokenOuts.length && n == nums.length && n == dens.length, "len mismatch");
        for (uint256 i; i < n; i++) {
            require(tokenIns[i] != tokenOuts[i], "same token");
            require(dens[i] > 0, "den=0");
            price[tokenIns[i]][tokenOuts[i]] = Price({num: nums[i], den: dens[i]});
            emit PriceSet(tokenIns[i], tokenOuts[i], nums[i], dens[i]);
        }
        emit PriceBatchSet(n);
    }



    function swapExactIn(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address to
    ) external returns (uint256 amountOut) {
        require(tokenIn != tokenOut, "same token");
        require(amountIn > 0, "amountIn=0");
        if (to == address(0)) to = msg.sender;

        Price memory p = price[tokenIn][tokenOut];
        require(p.den > 0, "price unset");

        amountOut = (amountIn * p.num) / p.den;
        require(amountOut >= minAmountOut, "slippage");

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        require(IERC20(tokenOut).balanceOf(address(this)) >= amountOut, "insufficient liquidity");
        IERC20(tokenOut).safeTransfer(to, amountOut);

        emit SwapExecuted(msg.sender, tokenIn, tokenOut, amountIn, amountOut, to);
    }

    function swapExactInFrom(
    address from,           // 토큰을 빼올 주체
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut,
    address to
) external returns (uint256 amountOut) {
    require(tokenIn != tokenOut, "same token");
    require(amountIn > 0, "amountIn=0");
    if (to == address(0)) to = from;

    Price memory p = price[tokenIn][tokenOut];
    require(p.den > 0, "price unset");

    amountOut = (amountIn * p.num) / p.den;
    require(amountOut >= minAmountOut, "slippage");

    // ✅ from 계정에서 Router로 토큰 가져오기
    IERC20(tokenIn).safeTransferFrom(from, address(this), amountIn);

    require(IERC20(tokenOut).balanceOf(address(this)) >= amountOut, "insufficient liquidity");
    IERC20(tokenOut).safeTransfer(to, amountOut);

    emit SwapExecuted(from, tokenIn, tokenOut, amountIn, amountOut, to);
}


    function withdraw(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
        emit Withdrawn(token, to, amount);
    }

    function drain(address token) external onlyOwner {
        uint256 bal = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransfer(owner(), bal);
        emit Withdrawn(token, owner(), bal);
    }
}
