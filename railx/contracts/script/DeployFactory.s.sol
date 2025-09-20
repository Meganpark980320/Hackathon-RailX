// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {Factory} from "../src/amm/Factory.sol";

contract DeployFactory is Script {
    function run() external {
        uint256 pk = vm.envUint("XRPL_DEPLOYER_PRIVATE_KEY");
        address feeTo = vm.envAddress("FEE_TO_ADDRESS");
        address owner = vm.addr(pk);

        vm.startBroadcast(pk);

        Factory factory = new Factory(owner);
        factory.setFeeTo(feeTo);
        factory.setProtocolFeeBps(1000);    // swap fee의 10%를 프로토콜로
        factory.setPoolFeeBps(5, 30);       // stable 0.05%, volatile 0.30%

        vm.stopBroadcast();

        console2.log("Factory: %s", address(factory));
        console2.log("Owner:   %s", owner);
        console2.log("feeTo:   %s", feeTo);
        console2.log("stableFeeBps:   %s", factory.stableFeeBps());
        console2.log("volatileFeeBps: %s", factory.volatileFeeBps());
        console2.log("protocolFeeBps: %s", factory.protocolFeeBps());
    }
}
