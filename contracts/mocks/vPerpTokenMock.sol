// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract vPerpTokenMock is IERC20Metadata, ERC20 {
    constructor(string memory symbol) ERC20("MockToken", symbol) {}

    function mint(address _to, uint256 _amount) external returns (bool) {
        _mint(_to, _amount);
        return true;
    }

    function mintArbitrary(address _to, uint256 _amount) external {
        _mint(_to, _amount);
    }

    function getIndexPrice(uint256) external pure returns (uint256) {
        return uint256(1500 * 1e18);
    }
}
