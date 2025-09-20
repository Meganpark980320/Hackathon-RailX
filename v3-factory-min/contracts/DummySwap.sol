// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract DummySwap {
    event Swapped(address indexed to, uint256 amount);

    function swapAndSend(address to, uint256 amount) external {
        emit Swapped(to, amount);
    }
}
