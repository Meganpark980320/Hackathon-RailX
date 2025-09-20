// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import "forge-std/Script.sol";
import "../src/HotWalletRouter.sol";

contract DeployRouter is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address ownerAddr = vm.addr(pk);

        vm.startBroadcast(pk);
        HotWalletRouter router = new HotWalletRouter(ownerAddr);
        vm.stopBroadcast();

        console2.log("HotWalletRouter deployed at:", address(router));
        console2.log("Owner:", ownerAddr);
    }
}
