// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "../../interfaces/IWrappedNativeToken.sol";
import "../../integrations/uniswap/v3/IV3SwapRouter.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";

interface IDcSwapperV3 {
    event Swapped(
        address indexed tokenA,
        address indexed tokenB,
        address recipient,
        uint256 amount
    );
    event DexUpgraded(address factoryAddress, address ammAddress);

    function amm() external view returns (IV3SwapRouter);

    function factory() external view returns (IUniswapV3Factory);

    function wrappedNativeToken() external view returns (address);

    function fees(uint256 i) external view returns (uint24);

    function setDex(address newFactory, address newAmm) external;

    function setFeesLevels(uint24[] memory newFees) external;

    function swap(
        address tokenA,
        address tokenB,
        uint256 amount,
        address recipient
    ) external payable returns (uint256);

    function isTokensSupported(address _bridgeToken, address[] memory _tokens)
        external
        view
        returns (bool[] memory);

    function isPairsSupported(address[][] calldata _tokens)
        external
        view
        returns (bool[] memory);

    function getBestFee(address tokenA, address tokenB)
        external
        view
        returns (
            address,
            uint24,
            address,
            address
        );

    function isTokenSupported(address bridgeToken, address token)
        external
        view
        returns (bool);
}
