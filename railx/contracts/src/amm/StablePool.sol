// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;
import {VolatilePool} from "./VolatilePool.sol";

contract StablePool is VolatilePool {
    // VolatilePool 로직 재사용 (feeBps만 Factory에서 5bps로 세팅)
    // isStable 플래그는 true로 설정됨.
}
