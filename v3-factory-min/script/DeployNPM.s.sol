// script/DeployNPM.s.sol
// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.6;

import "forge-std/Script.sol";

// ADDED: periphery NPM만 import (Descriptor는 import 안 함)
import { NonfungiblePositionManager } from "v3-periphery/NonfungiblePositionManager.sol";

contract DeployNPM is Script {
  // constructor(address _factory, address _WETH9, address _tokenDescriptor)
  function run(address FACT, address WNATIVE) external {
    vm.startBroadcast();

    // ADDED: descriptor 자리에 address(0) 전달
    NonfungiblePositionManager npm =
      new NonfungiblePositionManager(FACT, WNATIVE, address(0));

    console.log("NPM", address(npm));
    vm.stopBroadcast();
  }
}
