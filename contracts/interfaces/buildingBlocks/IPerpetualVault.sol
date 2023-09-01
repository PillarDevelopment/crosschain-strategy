// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "../../interfaces/IWrappedNativeToken.sol";
import "../../integrations/lib/Math.sol";
import "../../integrations/perpetual/IClearingHouse.sol";
import "../../integrations/perpetual/IVault.sol";
import "../../integrations/perpetual/IPerpPortal.sol";
import "../../integrations/perpetual/IIndexPrice.sol";
import "../../integrations/stargate/ISgBridge.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IPerpetualVault {
    event PositionAdjusted(
        bool operationType,
        bool positionType,
        uint256 amount
    );

    event EmergencyClosed(address sender, uint256 amount);
    event OpenPosition(address baseToken, bool positionType, uint256 amount);
    event ClosePosition(address baseToken, uint256 amount);
    event USDCDeposited(uint256 amount);
    event Withdrawal(address baseToken, uint256 amount);

    function wrappedNativeToken() external view returns (IERC20);

    function vToken() external view returns (IIndexPrice);

    function perpPortal() external view returns (IPerpPortal);

    function deadlineTime() external view returns (uint160);

    function perpReferralCode() external view returns (bytes32);

    function directDepositToVault(uint256 amount) external;

    function openPosition(int256 intAmount) external;

    function closePosition(uint256 _amount) external;

    function setPerpRefCode(bytes32 _code) external;

    function setPerpVToken(address newVToken) external;

    function getAccountValue() external view returns (int256);

    function getFreeCollateral() external view returns (uint256);

    function getNativeStrategyTokenPrice() external view returns (uint256);

    function getTotalAbsPositionValue() external view returns (uint256 value);

    function getTotalUSDCValue() external view returns (uint256);

    function getCurrentFundingRate() external view returns (uint256);

    function getLiquidatePrice() external view returns (uint256);
}
