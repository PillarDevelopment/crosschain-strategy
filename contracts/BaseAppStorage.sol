// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./integrations/stargate/ISgBridge.sol";
import "./interfaces/IBaseAppStorage.sol";

abstract contract BaseAppStorage is IBaseAppStorage {
    /// address of native stargateRouter for swap
    /// https://stargateprotocol.gitbook.io/stargate/interfaces/evm-solidity-interfaces/istargaterouter.sol
    /// https://stargateprotocol.gitbook.io/stargate/developers/contract-addresses/mainnet

    address public nativeRouter;

    address public sgBridge;

    address public currentUSDCToken;

    uint16 public nativeChainId;

    address public deCommasRelayerAddress;

    modifier onlyRelayer() {
        require(
            msg.sender == deCommasRelayerAddress,
            "BaseAppStorage:Only relayer"
        );
        _;
    }

    receive() external payable virtual {}

    function approve(
        address _baseAsset,
        address _spender,
        uint256 _amount
    ) public override onlyRelayer {
        IERC20(_baseAsset).approve(_spender, _amount);
    }

    function setRelayer(address _newRelayerAddress)
        public
        override
        onlyRelayer
    {
        deCommasRelayerAddress = _newRelayerAddress;
    }

    function setBridge(address _newSgBridge) public override onlyRelayer {
        sgBridge = _newSgBridge;
    }

    /**
     * @notice Set address of native stable token for this router
     * @param _newStableToken - newStableToken address of native stableToken
     * @dev only Relayer Address
     */
    function setStable(address _newStableToken)
        public
        override
        onlyRelayer
        returns (bool)
    {
        require(
            _newStableToken != address(0),
            "BaseAppStorage:setStable:invalid address"
        );
        currentUSDCToken = _newStableToken;
        return true;
    }

    function setNativeRouter(address _newNativeRouter)
        public
        override
        onlyRelayer
    {
        address oldNativeRouter = nativeRouter;
        nativeRouter = _newNativeRouter;
        emit RouterChanged(msg.sender, oldNativeRouter, _newNativeRouter);
    }

    function backTokensToNative(address _token, uint256 _amount)
        public
        override
        onlyRelayer
    {
        require(
            IERC20(_token).transfer(nativeRouter, _amount),
            "BBB:Transfer failed"
        );
        emit TransferredToNativeRouter(_token, _amount);
    }

    function bridge(
        address _nativeStableToken,
        uint256 _stableAmount,
        uint16 _receiverLZId,
        address _receiverAddress,
        address _destinationStableToken
    ) public payable override onlyRelayer {
        _bridge(
            _nativeStableToken,
            _stableAmount,
            _receiverLZId,
            _receiverAddress,
            _destinationStableToken,
            msg.value,
            ""
        );
    }

    function _bridge(
        address _nativeStableToken,
        uint256 _stableAmount,
        uint16 _receiverLZId,
        address _receiverAddress,
        address _destinationStableToken,
        uint256 _nativeValue,
        bytes memory _payload
    ) internal {
        if (
            nativeChainId == _receiverLZId &&
            _nativeStableToken == _destinationStableToken
        ) {
            IERC20(_nativeStableToken).transfer(
                _receiverAddress,
                _stableAmount
            );
            emit Bridged(_receiverLZId, _receiverAddress, _stableAmount);
            return;
        }
        IERC20(_nativeStableToken).approve(sgBridge, _stableAmount);
        ISgBridge(sgBridge).bridge{value: _nativeValue}(
            _nativeStableToken,
            _stableAmount,
            _receiverLZId,
            _receiverAddress,
            _destinationStableToken,
            _payload
        );
        emit Bridged(_receiverLZId, _receiverAddress, _stableAmount);
    }
}
