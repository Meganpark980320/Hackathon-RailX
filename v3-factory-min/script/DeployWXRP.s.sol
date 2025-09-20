// script/DeployWXRP.s.sol
// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.7.6;

import "forge-std/Script.sol";

// REMOVED: v3-periphery의 test/WETH9 import
// import { WETH9 } from "v3-periphery/test/WETH9.sol";

// ADDED: 로컬 WXRP 사용
import { WETH9 as WXRP } from "../src/vendor/WXRP.sol";

contract DeployWXRP is Script {
  function run() external {
    vm.startBroadcast();
    WXRP wxrp = new WXRP();
    console.log("WXRP", address(wxrp));
    vm.stopBroadcast();
  }
}
