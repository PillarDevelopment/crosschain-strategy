// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../../integrations/aave/v3/IPool.sol";
import "../../integrations/aave/v3/IRewardsController.sol";
import "../../integrations/aave/v3/IWETHGateway.sol";
import "../../integrations/aave/v3/IDebtTokenBase.sol";

interface IAaveVault {
    event OpenPositionEvent(IERC20 baseAsset, uint256 amount);
    event ClosePositionEvent(IERC20 baseAsset, uint256 amount);
    event BorrowEvent(IERC20 baseAsset, uint256 amount);
    event RepayEvent(IERC20 baseAsset, uint256 amount);
    event ClaimedRewardsEvent(address[] assets, address user);
    event SwapEvent(address[] path, uint256 amountIn, uint256 amountOut);
    event SetCollateralEvent(IERC20 asset);
    event SetUserEMode(uint8 emode);

    struct AaveVaultInitParams {
        IPoolAddressesProvider aaveProviderAddress;
        IWETHGateway wethGatewayAddress;
        IRewardsController rewardsControllerAddress;
        address relayerAddress;
        IERC20 usdcToken;
        address aaveStrategy;
        address wavaxVariableDebtTokenAddress;
        uint16 nativeId;
        address dcNativeRouter;
    }

    function aaveProvider() external view returns (IPoolAddressesProvider);

    function aaveLendingPool() external view returns (IPool);

    function wethGateway() external view returns (IWETHGateway);

    function rewardsController() external view returns (IRewardsController);

    function wavaxVariableDebtToken() external view returns (address);

    function aaveStrategy() external view returns (address);

    function transferToStrategy(address _asset, uint256 _amount) external;

    function setUserEMode(uint8 categoryId) external;

    function setCollateralAsset(address collateralAsset) external;

    function openPosition(
        IERC20 baseAsset,
        uint256 amount,
        uint16 referralCode
    ) external;

    function borrow(
        IERC20 borrowAsset,
        uint256 amount,
        uint16 borrowRate,
        uint16 referralCode
    ) external;

    function repay(
        IERC20 asset,
        uint256 amount,
        uint16 borrowRate
    ) external;

    function closePosition(IERC20 asset, uint256 amount) external;

    function claimAllRewards(address[] memory assets, address user) external;
}
