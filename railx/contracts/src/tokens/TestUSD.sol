// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";

contract TestUSD is ERC20, Ownable {
    uint8 private constant DEC = 6;
    constructor(string memory name_, string memory symbol_, address owner_) ERC20(name_, symbol_) Ownable(owner_) {}
    function decimals() public pure override returns (uint8) { return DEC; }
    function mint(address to, uint256 amount) external onlyOwner { _mint(to, amount); }
}