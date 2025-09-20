// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;

/// @notice 최소 구현: NPM이 호출할 tokenURI만 제공 (메타데이터 비움)
contract DummyDescriptor {
    function tokenURI(uint256) external pure returns (string memory) {
        return "";
    }
}
