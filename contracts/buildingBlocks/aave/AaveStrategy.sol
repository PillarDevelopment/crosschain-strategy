// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "../../integrations/aave/v3/IPool.sol";
import "../../integrations/aave/v3/IAaveOracle.sol";
import "../../interfaces/buildingBlocks/IAaveStrategy.sol";
import "../BaseBuildingBlock.sol";

contract AaveStrategy is IAaveStrategy, BaseBuildingBlock {
    IUniswapV2Router02 public uniswapV2Router;
    uint256 public chainId;

    function initialize(bytes memory _data) public initializer {
        (
            address relayer,
            IUniswapV2Router02 uniswapRouterAddress,
            address dcNativeRouter
        ) = abi.decode(_data, (address, IUniswapV2Router02, address));
        require(
            address(uniswapRouterAddress) != address(0),
            "AaveStrategy::initialize: uniswapRouter address zero"
        );
        require(
            address(relayer) != address(0),
            "AaveStrategy::initialize: relayer address zero"
        );
        require(
            address(dcNativeRouter) != address(0),
            "AaveStrategy::initialize: dcNativeRouter address zero"
        );
        __Ownable_init();
        deCommasRelayerAddress = relayer;
        nativeRouter = dcNativeRouter;
        uniswapV2Router = uniswapRouterAddress;
        assembly {
            sstore(chainId.slot, chainid())
        }
    }

    function setUniswapRouter(address newRouter) external onlyOwner {
        require(
            newRouter != address(0),
            "AaveStrategy::setUniswapRouter: address zero"
        );
        uniswapV2Router = IUniswapV2Router02(newRouter);
        emit UniSwapRouterSet(newRouter, msg.sender);
    }

    /**
     * @notice Swap exact tokens for Tokens uniswap v2
     * @param vault : amountIn to swap for amountOut, swap path and tx deadline time
     */
    function swap(
        address vault,
        uint256 amountIn,
        uint256 amountOutMin,
        address[] memory path,
        uint256 deadline
    ) public override onlyRelayer returns (uint256 amountOut) {
        require(vault != address(0), "AaveStrategy::swap: wrong vault address");
        require(amountIn > 0, "AaveStrategy::swap: wrong amountIn");
        require(path.length >= 2, "AaveStrategy::swap: wrong path");

        IAaveVault(vault).transferToStrategy(path[0], amountIn);

        if (address(path[0]) == address(0x0)) {
            // using avalanche id for joe trader swapExactTokensForAVAX
            if (chainId == 43114) {
                path[0] = uniswapV2Router.WAVAX();

                amountOut = uniswapV2Router.swapExactAVAXForTokens{
                    value: amountIn
                }(amountOutMin, path, vault, block.timestamp + deadline)[
                    path.length - 1
                ];
            } else {
                path[0] = uniswapV2Router.WETH();
                amountOut = uniswapV2Router.swapExactETHForTokens{
                    value: amountIn
                }(amountOutMin, path, vault, block.timestamp + deadline)[
                    path.length - 1
                ];
            }
        } else {
            if (address(path[path.length - 1]) == address(0x0)) {
                if (chainId == 43114) {
                    path[path.length - 1] = uniswapV2Router.WAVAX();
                } else {
                    path[path.length - 1] = uniswapV2Router.WETH();
                }
            }
            IERC20(path[0]).approve(address(uniswapV2Router), amountIn);
            amountOut = uniswapV2Router.swapExactTokensForTokens(
                amountIn,
                amountOutMin,
                path,
                vault,
                block.timestamp + deadline
            )[path.length - 1];
        }
        emit SwapEvent(vault, path, amountIn, amountOut);
    }
}
