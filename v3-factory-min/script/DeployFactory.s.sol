// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import "forge-std/Script.sol";
import "@uniswap/v3-core/contracts/UniswapV3Factory.sol";

contract DeployFactory is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);
        UniswapV3Factory factory = new UniswapV3Factory();
        console.log("FACTORY:", address(factory));
        vm.stopBroadcast();
    }
}
