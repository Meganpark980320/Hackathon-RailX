// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/DummySwap.sol";

contract DeployDummy is Script {
    function run() external {
        // ❌ 옛날: uint256 pk = vm.envUint("EVM_PRIVATE_KEY_DEC"); vm.startBroadcast(pk);
        // ✅ 새로: CLI --private-key 를 쓰게 하려면 인자 없이 호출
        vm.startBroadcast();
        new DummySwap();
        vm.stopBroadcast();
    }
}
