// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {TestUSD} from "../src/tokens/TestUSD.sol";
import {WXRP} from "../src/tokens/WXRP.sol";

contract DeployTokens is Script {
    function run() external {
        // env
        uint256 pk = vm.envUint("XRPL_DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);                  // ← 배포자 EOA
        address feeTo = vm.envAddress("FEE_TO_ADDRESS"); // 민트 받는 주소(원하면 변경)

        vm.startBroadcast(pk);

        // owner를 반드시 EOA로!
        TestUSD usdc = new TestUSD("USD Coin", "USDC", deployer);
        TestUSD usdt = new TestUSD("Tether USD", "USDT", deployer);
        WXRP wxrp = new WXRP();

        // onlyOwner(=deployer)로 민트 호출. 수령인은 feeTo로 지정
        usdc.mint(feeTo, 1_000_000 * 10**6);
        usdt.mint(feeTo, 1_000_000 * 10**6);

        // 필요하다면 오너를 feeTo로 넘겨도 됨 (선택)
        // usdc.transferOwnership(feeTo);
        // usdt.transferOwnership(feeTo);

        vm.stopBroadcast();

        console2.log("USDC: %s", address(usdc));
        console2.log("USDT: %s", address(usdt));
        console2.log("WXRP: %s", address(wxrp));
        console2.log("DeployerEOA: %s", deployer);
        console2.log("MintedTo: %s", feeTo);
    }
}
