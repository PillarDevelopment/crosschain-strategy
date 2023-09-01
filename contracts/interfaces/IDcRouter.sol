// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

interface IDcRouter {
    struct UserPosition {
        uint256 deposit; // [1e6]
        uint256 shares; // [1e6]
    }

    struct UserAction {
        address user;
        uint256 amount;
    }

    event Deposited(address indexed user, uint256 indexed id, uint256 amount);
    event DepositTransferred(
        address indexed user,
        uint256 indexed strategyId,
        uint256 amount
    );
    event RequestedWithdraw(
        address indexed user,
        uint256 indexed id,
        uint256 amount
    );
    event Withdrawn(address indexed user, uint256 indexed id, uint256 amount);
    event CancelWithdrawn(
        address indexed user,
        uint256 indexed id,
        uint256 amount
    );

    function deCommasTreasurer() external view returns (address);

    function deposit(uint256 _strategyId, uint256 _stableAmount) external;

    function initiateWithdraw(uint256 _strategyId, uint256 _stableAmount)
        external;

    function withdrawLossTokens(address _token, uint256 _amount) external;

    function approveWithdraw(
        uint256 _stableDeTokenPrice,
        uint256 _strategyId,
        uint256 _withdrawalId
    ) external returns (bool);

    function cancelWithdraw(uint256 _withdrawalId, uint256 _strategyId)
        external
        returns (bool);

    function transferDeposits(
        uint16[] memory receiverLzId,
        address[] memory receivers,
        uint256[] memory amounts,
        address[] memory destinationTokens,
        uint256 strategyId,
        uint256 strategyTvl
    ) external payable;
}
