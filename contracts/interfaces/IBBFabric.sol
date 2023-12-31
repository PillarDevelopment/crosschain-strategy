// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

interface IBBFabric {
    event NewBBCreated(
        uint256 strategyId,
        address indexed implementation,
        address indexed proxy,
        bytes initializibleData
    );

    event RegistryNotified(
        uint256 indexed strategyId,
        address implementation,
        address proxy,
        address registryAddress,
        uint16 registryChain
    );

    struct BaseBlockData {
        uint256 id;
        address implement;
        address proxy;
    }

    function initNewProxy(
        uint256 _strategyId,
        address _implementation,
        bytes memory _dataForConstructor
    ) external payable returns (bool);

    function getProxyAddressToId(uint256 _allBlockInChainId)
        external
        view
        returns (address);

    function getImplToProxyAddress(address _proxy)
        external
        view
        returns (address impl);

    function getStrategyIdToProxyAddress(address _proxy)
        external
        view
        returns (uint256 strategyId);

    function getAllBbData() external view returns (BaseBlockData[] memory);
}
