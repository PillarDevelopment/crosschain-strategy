// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "../buildingBlocks/BaseBuildingBlock.sol";

contract BBMock is BaseBuildingBlock {
    function initialize(bytes memory _data) public initializer {
        (
            address relayerAddress,
            address usdcTokenAddress,
            uint16 nativeId,
            address dcNativeRouter
        ) = abi.decode(_data, (address, address, uint16, address));
        require(
            relayerAddress != address(0),
            "BBMock::initialize:relayer zero address"
        );
        require(
            usdcTokenAddress != address(0),
            "BBMock::initialize:token zero address"
        );
        require(nativeId != 0, "BBMock::initialize:id zero");
        require(
            dcNativeRouter != address(0),
            "BBMock::initialize:router zero address"
        );
        __Ownable_init();
        deCommasRelayerAddress = relayerAddress;
        currentUSDCToken = usdcTokenAddress;
        nativeChainId = nativeId;
        nativeRouter = dcNativeRouter;
    }
}
