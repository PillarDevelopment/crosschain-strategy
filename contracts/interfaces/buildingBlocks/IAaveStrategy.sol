// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../integrations/uniswap/v2/IUniswapV2Router02.sol";
import "../../interfaces/buildingBlocks/IAaveVault.sol";

interface IAaveStrategy {
    event SwapEvent(
        address vault,
        address[] path,
        uint256 amountIn,
        uint256 amountOut
    );

    event UniSwapRouterSet(address newRouter, address user);

    function uniswapV2Router() external returns (IUniswapV2Router02);

    function setUniswapRouter(address newRouter) external;

    function swap(
        address vault,
        uint256 amountIn,
        uint256 amountOutMin,
        address[] memory path,
        uint256 deadline
    ) external returns (uint256 amountOut);
}
