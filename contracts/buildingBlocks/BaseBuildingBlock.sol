// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "../BaseAppStorage.sol";

abstract contract BaseBuildingBlock is
    BaseAppStorage,
    Initializable,
    OwnableUpgradeable,
    UUPSUpgradeable
{
    function _authorizeUpgrade(address) internal override onlyOwner {}
}
