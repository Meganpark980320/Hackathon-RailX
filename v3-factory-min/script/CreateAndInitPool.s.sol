// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "forge-std/Script.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";

contract CreateAndInitPool is Script {
    // sqrtPriceX96 = sqrt(price) * 2^96
    function _sqrtPriceX96(uint256 priceE18) internal pure returns (uint160) {
        // priceE18: token1/token0 price scaled by 1e18 (e.g., 1e18 for 1.0)
        // sqrt(1e18) = 1e9, so base = 2^96 * 1e9 / 1e9 when price = 1
        // We’ll compute sqrt via Babylonian method on uint256 with 1e18 scale.
        uint256 x = priceE18;
        require(x > 0, "price=0");

        // Babylonian sqrt for 1e18-scaled input, result scaled by 1e9
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        // y ~= sqrt(priceE18) scaled by 1e9
        // sqrtPriceX96 = y * 2^96 / 1e9
        uint256 two96 = uint256(1) << 96;
        uint256 val = (two96 * y) / 1e9;
        require(val <= type(uint160).max, "overflow");
        return uint160(val);
    }

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address factory = vm.envAddress("FACTORY_ADDR");
        address tokenA = vm.envAddress("TOKEN_A"); // token0 후보
        address tokenB = vm.envAddress("TOKEN_B"); // token1 후보
        uint24 fee = uint24(vm.envUint("FEE"));    // 500, 3000, 10000 중 하나
        // 예: 1e18 = 1.0, 2e18 = 2.0, 5e17 = 0.5
        uint256 priceE18 = vm.envUint("INIT_PRICE_E18");

        vm.startBroadcast(pk);

        // createPool (순서는 상관없지만, 보통 token0<token1 권장)
        address pool = IUniswapV3Factory(factory).createPool(tokenA, tokenB, fee);
        console.log("POOL:", pool);

        // initialize (한 번만 가능)
        uint160 sqrtPriceX96 = _sqrtPriceX96(priceE18);
        IUniswapV3Pool(pool).initialize(sqrtPriceX96);
        console.log("Initialized sqrtPriceX96:", uint256(sqrtPriceX96));

        vm.stopBroadcast();
    }
}
