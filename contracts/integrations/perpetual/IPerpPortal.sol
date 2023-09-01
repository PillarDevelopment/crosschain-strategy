// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.12;

interface IPerpPortal {
    // https://optimistic.etherscan.io/address/0xa18fa074a2A5B01E69a35771E709553af4676558
    // long:
    // accountValue - positionSizeOfTokenX * (indexPrice - liqPrice) =
    //      totalPositionValue * mmRatio - positionSizeOfTokenX * (indexPrice - liqPrice) * mmRatio
    // liqPrice = indexPrice - ((accountValue - totalPositionValue * mmRatio) /  ((1 - mmRatio) * positionSizeOfTokenX))
    // short:
    // accountValue - positionSizeOfTokenX * (indexPrice - liqPrice) =
    //      totalPositionValue * mmRatio + positionSizeOfTokenX * (indexPrice - liqPrice) * mmRatio
    // liqPrice = indexPrice - ((accountValue - totalPositionValue * mmRatio) /  ((1 + mmRatio) * positionSizeOfTokenX))
    function getLiquidationPrice(address trader, address baseToken)
        external
        view
        returns (uint256);

    // ClearingHouse view functions
    function getAccountValue(address trader) external view returns (int256);

    function getQuoteToken() external view returns (address); // vUSD

    function getUniswapV3Factory() external view returns (address);

    // Exchange view functions
    function getAllPendingFundingPayment(address trader)
        external
        view
        returns (int256);

    function getPendingFundingPayment(address trader, address baseToken)
        external
        view
        returns (int256);

    function getSqrtMarkTwapX96(address baseToken, uint32 twapInterval)
        external
        view
        returns (uint160);

    // AccountBalance view functions
    function getBaseTokens(address trader)
        external
        view
        returns (address[] memory);

    function getMarginRequirementForLiquidation(address trader)
        external
        view
        returns (int256);

    function getPnlAndPendingFee(address trader)
        external
        view
        returns (
            int256 owedRealizedPnl,
            int256 unrealizedPnl,
            uint256 pendingFee
        );

    function getTotalAbsPositionValue(address trader)
        external
        view
        returns (uint256);

    // ClearingHouseConfig view functions
    function getLiquidationPenaltyRatio() external view returns (uint24);

    function getPartialCloseRatio() external view returns (uint24);

    function getTwapInterval() external view returns (uint32);

    // Vault view functions
    function getBalance(address account) external view returns (int256);

    function getFreeCollateral(address trader) external view returns (uint256);

    function getFreeCollateralByRatio(address trader, uint24 ratio)
        external
        view
        returns (int256);

    // perpPortal view functions
    function getClearingHouse() external view returns (address);

    function getClearingHouseConfig() external view returns (address);

    function getAccountBalance() external view returns (address);

    function getExchange() external view returns (address);

    function getVault() external view returns (address);
}
