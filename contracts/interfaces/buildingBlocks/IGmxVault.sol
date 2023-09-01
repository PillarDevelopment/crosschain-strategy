// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../integrations/gmx/IVault.sol";
import "../../integrations/gmx/IVault.sol";
import "../../integrations/gmx/IRewardRouterV2.sol";
import "../../integrations/gmx/IGlpManager.sol";

interface IGmxVault {
    event BuyingEvent(IERC20 token, uint256 amount, uint256 glpAmountReceived);
    event SellingEvent(IERC20 token, uint256 glpAmount, uint256 amountReceived);

    function buyGLP(
        IERC20 token,
        uint256 amount,
        uint256 minUsdg,
        uint256 minGlp
    ) external returns (uint256 glpBoughtAmount);

    function sellGLP(
        IERC20 tokenOut,
        uint256 glpAmount,
        uint256 minOut
    ) external returns (uint256 amountPayed);

    function claimRewards(
        bool shouldClaimGmx,
        bool shouldStakeGmx,
        bool shouldClaimEsGmx,
        bool shouldStakeEsGmx,
        bool shouldStakeMultiplierPoints,
        bool shouldClaimWeth,
        bool shouldConvertWethToEth
    ) external returns (bool);

    function gmxVault() external returns (IVault);

    function mintRouter() external returns (IRewardRouterV2);

    function rewardRouter() external returns (IRewardRouterV2);

    function glpManager() external returns (IGlpManager);

    function glpToken() external returns (IERC20);

    function glpTrackerToken() external returns (IERC20);

    function getTvl() external view returns (uint256);

    function getWeights(address[] calldata _assets)
        external
        view
        returns (uint256[] memory);
}
