// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;
import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {FactoryV2} from "../src/amm/FactoryV2.sol";
import {Router} from "../src/amm/Router.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

interface IWXRP {
    function deposit() external payable;
}

contract DeployAMM is Script {
    function run() external {
        uint256 pk = vm.envUint("XRPL_DEPLOYER_PRIVATE_KEY");
        address owner = vm.addr(pk);
        address feeTo = vm.envAddress("FEE_TO_ADDRESS");

        address USDC = vm.envAddress("NEXT_PUBLIC_TOKEN_USDC");
        address USDT = vm.envAddress("NEXT_PUBLIC_TOKEN_USDT");
        address WXRP = vm.envAddress("NEXT_PUBLIC_TOKEN_WXRP");

        vm.startBroadcast(pk);

        // 1) FactoryV2 + Router(USDC hub)
        FactoryV2 factory = new FactoryV2(owner);
        factory.setFeeTo(feeTo);
        factory.setProtocolFeeBps(1000); // 10% of swap fee to feeTo
        factory.setPoolFeeBps(5, 30);    // stable 5bps, volatile 30bps

        Router router = new Router(address(factory), USDC);

        console2.log("FactoryV2:", address(factory));
        console2.log("Router:", address(router));

        // 2) Create pools
        address poolStable = factory.createPool(USDC, USDT, true);
        address poolVol    = factory.createPool(WXRP, USDC, false);
        console2.log("USDC-USDT(stable):", poolStable);
        console2.log("WXRP-USDC(volatile):", poolVol);

        // 3) Seed liquidity (tiny)
        // approve router to pull
        IERC20(USDC).approve(address(router), type(uint256).max);
        IERC20(USDT).approve(address(router), type(uint256).max);
        IERC20(WXRP).approve(address(router), type(uint256).max);

        // ensure we have some WXRP (wrap 1 XRP)
        try IWXRP(WXRP).deposit{value: 1e18}() {} catch {}

        // amounts: 10,000 units for 6-decimals tokens; 1e18 for WXRP
        uint amountUSDC = 10_000 * 10**6;
        uint amountUSDT = 10_000 * 10**6;
        uint amountWXRP = 1e18; // 1 XRP

        router.addLiquidity(USDC, USDT, true,  amountUSDC, amountUSDT, owner);
        router.addLiquidity(WXRP, USDC, false, amountWXRP, amountUSDC, owner);

        vm.stopBroadcast();
    }
}
