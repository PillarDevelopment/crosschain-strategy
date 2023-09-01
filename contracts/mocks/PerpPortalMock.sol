// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.12;

contract PerpPortalMock {
    address public vault;
    address public clearingHouse;
    uint256 public freeCollateral;

    constructor(address _vault, address _clearingHouse) {
        vault = _vault;
        clearingHouse = _clearingHouse;
        freeCollateral = uint256(1e18);
    }

    function getLiquidationPrice(address, address)
        external
        pure
        returns (uint256)
    {
        return uint256(1e18);
    }

    function getClearingHouse() external view returns (address) {
        return clearingHouse;
    }

    function getFreeCollateral(address) external view returns (uint256) {
        return freeCollateral;
    }

    function modifyFreeCollateral(uint256 _newCollateralAmount) external {
        freeCollateral = _newCollateralAmount;
    }

    function getTotalAbsPositionValue(address) external pure returns (uint256) {
        return uint256(1e18);
    }

    function getAccountValue(address) external pure returns (int256) {
        return int256(1e18);
    }

    function getSqrtMarkTwapX96(address, uint32)
        external
        pure
        returns (uint160)
    {
        return uint160(15000);
    }

    function getTwapInterval() external pure returns (uint32) {
        return uint32(900);
    }

    function getVault() external view returns (address) {
        return vault;
    }
}
