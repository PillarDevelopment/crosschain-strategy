// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "./BaseAppStorage.sol";
import "./interfaces/IDcRouter.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @author DeCommas team
 * @title Implementation of the basic multiChain DeCommasStrategyRouter.
 * @dev Originally based on code by Pillardev: https://github.com/Pillardevelopment
 * @dev Original idea on architecture by Loggy: https://miro.com/app/board/uXjVOZbZQQI=/?fromRedirect=1
 */
contract DcRouter is Ownable, BaseAppStorage, IDcRouter {
    /// deCommas address of Building block contract for lost funds
    address public deCommasTreasurer;

    mapping(uint256 => uint256) public pendingStrategyDeposits;
    mapping(uint256 => uint256) public pendingStrategyWithdrawals;

    // @dev Aware of user's total deposit and amount of shares.
    mapping(address => mapping(uint256 => UserPosition)) public userPosition;

    // @dev (strategyId => depositId => UserDeposit)
    mapping(uint256 => mapping(uint256 => UserAction))
        public pendingDepositsById;
    mapping(uint256 => uint256) public lastPendingDepositId;
    mapping(uint256 => uint256) public maxProcessedDepositId;

    mapping(uint256 => mapping(uint256 => UserAction))
        public pendingWithdrawalsById;
    mapping(uint256 => uint256) public lastPendingWithdrawalId;
    mapping(uint256 => uint256) public maxProcessedWithdrawalId;

    /**
     * @notice DcRouter for Users
     * @param _relayerAddress -
     * @param _deCommasTreasurerAddress - address of Treasurer
     * @param _usdcAddress - native stableToken(USDT,USDC,DAI...)
     * @param _nativeId - (https://layerzero.gitbook.io/docs/technical-reference/testnet/testnet-addresses)
     */
    constructor(
        address _relayerAddress,
        address _deCommasTreasurerAddress,
        address _usdcAddress,
        uint16 _nativeId
    ) {
        require(
            _relayerAddress != address(0),
            "DcRouter::constructor: relayer is zero address"
        );
        require(
            _deCommasTreasurerAddress != address(0),
            "DcRouter::constructor:treasures is zero address"
        );
        require(
            _usdcAddress != address(0),
            "DcRouter::constructor:usdc is zero address"
        );
        require(_nativeId != 0, "DcRouter::constructor:nativeId is zero");
        deCommasRelayerAddress = _relayerAddress;
        deCommasTreasurer = _deCommasTreasurerAddress;
        currentUSDCToken = _usdcAddress;
        nativeChainId = _nativeId;
        _transferOwnership(_msgSender());
    }

    /**
     * @notice User can to deposit his stable Token, after Approve
     * @param _strategyId - strategy number by which it will be identified
     * @param _stableAmount - decimals amount is blockchain specific
     * @dev If user want ERC20, He can to mint in special contract -
     */
    function deposit(uint256 _strategyId, uint256 _stableAmount)
        external
        override
    {
        require(_stableAmount > 0, "DcRouter::deposit: zero amount");
        require(
            IERC20(currentUSDCToken).transferFrom(
                _msgSender(),
                address(this),
                _stableAmount
            ),
            "DcRouter::deposit: transfer failed"
        );

        uint256 newId = ++lastPendingDepositId[_strategyId];
        pendingDepositsById[_strategyId][newId] = UserAction(
            _msgSender(),
            _stableAmount
        );
        pendingStrategyDeposits[_strategyId] += _stableAmount;
        emit Deposited(_msgSender(), _strategyId, _stableAmount);
    }

    /**
     * @notice User submits a request to withdraw his tokens
     * @param _strategyId - strategy number by which it will be identified
     * @param _stableAmount - how many of ERC-1155 deTokens user would withdraw
     * @dev 18 decimals
     */
    function initiateWithdraw(uint256 _strategyId, uint256 _stableAmount)
        external
        override
    {
        uint256 newId = ++lastPendingWithdrawalId[_strategyId];
        pendingWithdrawalsById[_strategyId][newId] = UserAction(
            _msgSender(),
            _stableAmount
        );
        if (
            pendingStrategyWithdrawals[_strategyId] != type(uint256).max &&
            _stableAmount != type(uint256).max
        ) {
            pendingStrategyWithdrawals[_strategyId] += _stableAmount;
        } else {
            pendingStrategyWithdrawals[_strategyId] = type(uint256).max;
        }
        emit RequestedWithdraw(_msgSender(), _strategyId, _stableAmount);
    }

    // @dev transfer deposits from this router to the BB
    // payload contains users which deposits are eligible for transfer
    function transferDeposits(
        uint16[] memory receiverLzId,
        address[] memory receivers,
        uint256[] memory amounts,
        address[] memory destinationTokens,
        uint256 strategyId,
        uint256 strategyTvl
    ) public payable override onlyRelayer {
        uint256 pendingTotal;
        require(
            maxProcessedDepositId[strategyId] <
                lastPendingDepositId[strategyId],
            "DcRouter::transferDeposits: no deposit to process"
        );
        for (
            uint256 i = maxProcessedDepositId[strategyId] + 1;
            i <= lastPendingDepositId[strategyId];
            i++
        ) {
            UserAction memory pendingUserDeposit = pendingDepositsById[
                strategyId
            ][i]; //save gas on sLoad
            pendingTotal += pendingUserDeposit.amount;
            pendingStrategyDeposits[strategyId] -= pendingUserDeposit.amount;
            _updateUserShares(strategyTvl, strategyId, pendingUserDeposit);

            emit DepositTransferred(
                pendingUserDeposit.user,
                strategyId,
                pendingUserDeposit.amount
            );
        }
        maxProcessedDepositId[strategyId] = lastPendingDepositId[strategyId];

        uint256 amountsSum;
        for (uint256 i = 0; i < amounts.length; i++) {
            amountsSum += amounts[i];
        }
        require(
            pendingTotal == amountsSum,
            "DcRouter::transferDeposits: users amount mismatch"
        );

        for (uint256 i = 0; i < amounts.length; i++) {
            if (amounts[i] > 0) {
                _bridge(
                    currentUSDCToken,
                    amounts[i],
                    receiverLzId[i],
                    receivers[i],
                    destinationTokens[i],
                    address(this).balance,
                    "" // payload
                );
            }
        }
    }

    /**
     * @notice Rescuing Lost Tokens
     * @param _token - address of the erroneously submitted token to extrication
     * @param _amount - amount of the erroneously submitted token to extrication
     */
    function withdrawLossTokens(address _token, uint256 _amount)
        public
        override
        onlyRelayer
    {
        if (_token == address(0)) {
            payable(deCommasTreasurer).transfer(_amount);
        } else {
            require(
                IERC20(_token).transfer(deCommasTreasurer, _amount),
                "DcRouter::withdrawLossTokens: transfer failed"
            );
        }
    }

    function approveWithdraw(
        uint256 _stableDeTokenPrice,
        uint256 _strategyId,
        uint256 _withdrawalId
    ) public override onlyRelayer returns (bool) {
        require(
            _withdrawalId == maxProcessedWithdrawalId[_strategyId] + 1,
            "DcRouter::approveWithdraw: invalid request id"
        );
        uint256 stableWithdraw;
        address receiver = pendingWithdrawalsById[_strategyId][_withdrawalId]
            .user;
        if (pendingStrategyWithdrawals[_strategyId] == type(uint256).max) {
            stableWithdraw =
                (userPosition[receiver][_strategyId].shares *
                    _stableDeTokenPrice) /
                1e18;
            userPosition[receiver][_strategyId].shares = 0;
            pendingStrategyWithdrawals[_strategyId] = 0;
        } else {
            stableWithdraw =
                (pendingWithdrawalsById[_strategyId][_withdrawalId].amount *
                    _stableDeTokenPrice) /
                1e18;
            userPosition[receiver][_strategyId]
                .shares -= pendingWithdrawalsById[_strategyId][_withdrawalId]
                .amount;
            pendingStrategyWithdrawals[_strategyId] -= pendingWithdrawalsById[
                _strategyId
            ][_withdrawalId].amount;
        }

        maxProcessedWithdrawalId[_strategyId] += 1;

        require(
            IERC20(currentUSDCToken).transfer(
                pendingWithdrawalsById[_strategyId][_withdrawalId].user,
                stableWithdraw
            ),
            "DcRouter::approveWithdraw: transfer failed"
        );

        emit Withdrawn(
            pendingWithdrawalsById[_strategyId][_withdrawalId].user,
            _strategyId,
            stableWithdraw
        );
        return true;
    }

    /**
     * @notice Relayer address cancel withdraw request
     * @param _withdrawalId -
     * @param _strategyId -
     * @dev only Relayer address
     */
    function cancelWithdraw(uint256 _withdrawalId, uint256 _strategyId)
        public
        override
        onlyRelayer
        returns (bool)
    {
        require(
            _withdrawalId == maxProcessedWithdrawalId[_strategyId] + 1,
            "DcRouter::cancelWithdraw: invalid request id"
        );
        if (pendingStrategyWithdrawals[_strategyId] == type(uint256).max) {
            pendingStrategyWithdrawals[_strategyId] = 0;
        } else {
            pendingStrategyWithdrawals[_strategyId] -= pendingWithdrawalsById[
                _strategyId
            ][_withdrawalId].amount;
        }
        maxProcessedWithdrawalId[_strategyId]++;
        emit CancelWithdrawn(
            pendingWithdrawalsById[_strategyId][_withdrawalId].user,
            _strategyId,
            pendingWithdrawalsById[_strategyId][_withdrawalId].amount
        );
        return true;
    }

    // @dev Calculate user shares based on strategy TVL. Tvl should be provided by relayers
    function _updateUserShares(
        uint256 _tvl,
        uint256 _strategyId,
        UserAction memory userDeposit
    ) internal {
        userPosition[userDeposit.user][_strategyId].deposit += userDeposit
            .amount;
        if (_tvl == 0) {
            // special case when BB is empty. Calculate shares as 1:1 deposit
            userPosition[userDeposit.user][_strategyId].shares += userDeposit
                .amount;
        } else {
            // amount / tvl is the share of the one token. Multiply it by amount to get total shares
            userPosition[userDeposit.user][_strategyId].shares +=
                (userDeposit.amount * userDeposit.amount) /
                _tvl;
        }
    }
}
