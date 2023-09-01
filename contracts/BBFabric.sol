// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import "./BaseAppStorage.sol";
import "./interfaces/IBBFabric.sol";

/**
 * @author DeCommas team
 * @title Implementation of
 * @dev Originally based on code by Pillardev: https://github.com/Pillardevelopment
 * @dev Original idea on architecture by Loggy: https://miro.com/app/board/uXjVOZbZQQI=/?fromRedirect=1
 */
contract BBFabric is BaseAppStorage, Ownable, IBBFabric {
    /// array save data about basic blocks of current EVM network
    mapping(address => BaseBlockData) private _bBlocks;

    BaseBlockData[] private _allBlockInChain;

    constructor(uint16 _nativeId, address _relayerAddress) {
        require(_nativeId != 0, "BBFabric::constructor:nativeId is zero");
        require(
            _relayerAddress != address(0),
            "BBFabric::constructor:relayer is zero address"
        );
        nativeChainId = _nativeId;
        deCommasRelayerAddress = _relayerAddress;
        _transferOwnership(_msgSender());
    }

    function getProxyAddressToId(uint256 _allBlockInChainId)
        external
        view
        override
        returns (address)
    {
        return _allBlockInChain[_allBlockInChainId].proxy;
    }

    function getImplToProxyAddress(address _proxy)
        external
        view
        override
        returns (address impl)
    {
        impl = _bBlocks[_proxy].implement;
    }

    function getStrategyIdToProxyAddress(address _proxy)
        external
        view
        override
        returns (uint256 strategyId)
    {
        strategyId = _bBlocks[_proxy].id;
    }

    function getAllBbData()
        external
        view
        override
        returns (BaseBlockData[] memory)
    {
        return _allBlockInChain;
    }

    /**
     * @param _strategyId - strategy number by which it will be identified
     * @param _implementation - address of Building block contract proxy's source code
     * @param _dataForConstructor - data for  initialize function in Building block contract
     */
    function initNewProxy(
        uint256 _strategyId,
        address _implementation,
        bytes memory _dataForConstructor
    ) public payable override onlyRelayer returns (bool) {
        return _initProxy(_strategyId, _implementation, _dataForConstructor);
    }

    function _initProxy(
        uint256 _strategyId,
        address _implementation,
        bytes memory _dataForConstructor
    ) internal returns (bool) {
        bytes memory emptyData;
        BeaconProxy proxy = new BeaconProxy(_implementation, emptyData);
        bytes memory initializeData = abi.encodeWithSelector(
            bytes4(keccak256(bytes("initialize(bytes)"))),
            _dataForConstructor
        );
        (bool success, bytes memory returnData) = address(proxy).call(
            initializeData
        );
        if (!success) {
            revert(_getRevertMsg(returnData));
        }
        BaseBlockData memory newBaseBlockData = BaseBlockData({
            id: _strategyId,
            implement: _implementation,
            proxy: address(proxy)
        });
        _allBlockInChain.push(newBaseBlockData);
        _bBlocks[address(proxy)] = newBaseBlockData;
        emit NewBBCreated(
            _strategyId,
            _implementation,
            address(proxy),
            returnData
        );

        return success;
    }

    function _getRevertMsg(bytes memory _returnData)
        internal
        pure
        returns (string memory)
    {
        // If the _res length is less than 68, then the transaction failed silently (without a revert message)
        if (_returnData.length < 68) return "BBFabric:local call fail";

        assembly {
            // Slice the sighash.
            _returnData := add(_returnData, 0x04)
        }
        return abi.decode(_returnData, (string));
    }
}
