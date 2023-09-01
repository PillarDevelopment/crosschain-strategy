// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

interface IBaseAppStorage {
    event Bridged(
        uint16 indexed receiverLZId,
        address indexed receiverAddress,
        uint256 stableAmount
    );
    event RouterChanged(
        address indexed sender,
        address oldRelayer,
        address newRelayer
    );

    event TransferredToNativeRouter(address indexed token, uint256 amount);

    function sgBridge() external view returns (address);

    function currentUSDCToken() external view returns (address);

    function nativeRouter() external view returns (address);

    function deCommasRelayerAddress() external view returns (address);

    function nativeChainId() external view returns (uint16);

    function approve(
        address _baseAsset,
        address _spender,
        uint256 _amount
    ) external;

    function setRelayer(address _newRelayerAddress) external;

    function setBridge(address _newSgBridge) external;

    function setStable(address _newStableToken) external returns (bool);

    function setNativeRouter(address _newNativeRouter) external;

    function backTokensToNative(address _token, uint256 _amount) external;

    function bridge(
        address _nativeStableToken,
        uint256 _stableAmount,
        uint16 _receiverLZId,
        address _receiverAddress,
        address _destinationStableToken
    ) external payable;
}
