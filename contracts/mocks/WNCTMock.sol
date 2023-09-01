// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract WNCTMock is IERC20Metadata, ERC20 {
    constructor() ERC20("WNCTMock", "wNCT") {}

    function deposit() public payable {}

    function withdraw(uint256 wad) external pure returns (uint256) {
        return wad;
    }

    function mint(address _to, uint256 _amount) external returns (bool) {
        _mint(_to, _amount);
        return true;
    }
}
