// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "v3-core/contracts/UniswapV3Pool.sol";
contract ProbeInitHash {
    function get() external pure returns (bytes32) {
        return keccak256(type(UniswapV3Pool).creationCode);
    }
}
