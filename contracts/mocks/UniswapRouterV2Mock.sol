// SPDX-License-Identifier: MIT

pragma solidity ^0.8.12;

import "./ERC20Mock.sol";
import "hardhat/console.sol";

contract UniswapRouterV2Mock {
    address public WETH;
    address public WAVAX;

    constructor(address _weth, address _wavax) {
        WETH = _weth;
        WAVAX = _wavax;
    }

    fallback() external payable {}

    receive() external payable {}

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256,
        address[] calldata path,
        address to,
        uint256
    ) external returns (uint256[] memory amounts) {
        ERC20Mock(path[0]).transferFrom(msg.sender, address(this), amountIn);
        amounts = new uint256[](3);
        amounts[2] = amountIn;
        ERC20Mock(path[path.length - 1]).mint(to, amountIn);
    }

    function swapExactETHForTokens(
        uint256,
        address[] calldata path,
        address to,
        uint256
    ) external payable returns (uint256[] memory amounts) {
        ERC20Mock(path[path.length - 1]).transfer(address(to), msg.value);
        amounts = new uint256[](2);
        amounts[1] = msg.value;
    }

    function swapExactAVAXForTokens(
        uint256,
        address[] calldata path,
        address to,
        uint256
    ) external payable returns (uint256[] memory amounts) {
        ERC20Mock(path[path.length - 1]).transfer(address(to), msg.value);
        amounts = new uint256[](2);
        amounts[1] = msg.value;
    }
}
