// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "../interfaces/buildingBlocks/IPerpetualVault.sol";
import "./BaseBuildingBlock.sol";

/**
    @author DeCommas team
    @title Perp protocol interface to open and close positions for specific pair and leverage size.
 */
contract PerpetualVault is BaseBuildingBlock, IPerpetualVault {
    IERC20 public wrappedNativeToken;
    IIndexPrice public vToken;
    IPerpPortal public perpPortal;
    uint160 public deadlineTime;
    bytes32 public perpReferralCode;

    /**
     * @dev Sets the addresses for relayer, perpPortal, USDC stableCoin, wrappedNativeToken token address,
     * Perpetual vToken for Strategy id, native Id
     * initialize to base shares for position
     */
    function initialize(bytes memory _data) public initializer {
        (
            address relayerAddress,
            address optimismPerpPortal,
            address usdcTokenAddress,
            address wTokenAddress,
            address baseToken,
            uint16 nativeId,
            uint160 deadline,
            address dcNativeRouter
        ) = abi.decode(
                _data,
                (
                    address,
                    address,
                    address,
                    address,
                    address,
                    uint16,
                    uint160,
                    address
                )
            );

        require(
            relayerAddress != address(0),
            "PerpetualVault::initialize: relayer zero address"
        );
        require(
            optimismPerpPortal != address(0),
            "PerpetualVault::initialize: optimismPerpPortal zero address"
        );
        require(
            usdcTokenAddress != address(0),
            "PerpetualVault::initialize: usdcTokenAddress zero address"
        );
        require(
            wTokenAddress != address(0),
            "PerpetualVault::initialize: wTokenAddress zero address"
        );
        require(
            baseToken != address(0),
            "PerpetualVault::initialize: baseToken zero address"
        );
        require(nativeId > 0, "PerpetualVault::initialize: nativeId zero id");
        require(
            dcNativeRouter != address(0),
            "PerpetualVault::initialize: dcNativeRouter zero address"
        );

        __Ownable_init();
        _transferOwnership(_msgSender());

        deCommasRelayerAddress = relayerAddress;
        perpPortal = IPerpPortal(optimismPerpPortal);
        currentUSDCToken = usdcTokenAddress;
        wrappedNativeToken = IERC20(wTokenAddress);
        _setPerpVToken(IIndexPrice(baseToken));
        nativeChainId = nativeId;
        nativeRouter = dcNativeRouter;
        deadlineTime = deadline;
        IERC20(currentUSDCToken).approve(
            perpPortal.getVault(),
            type(uint256).max
        );
    }

    /**
     * @notice direct deposit into perpetual protocol vault
     * @dev used for native chain _deposits
     * @param amount :  amount to deposit usdc
     */
    function directDepositToVault(uint256 amount) public override onlyRelayer {
        require(
            amount > 0,
            "PerpetualVault::directDepositToVault: zero amount"
        );
        _depositToVault(amount);
    }

    /**
     * @notice Function to Adjust/open -short-long and full close positions
     * @param intAmount - operationType: open/close position,positionType: true/false (long/short) & position amount
     * @dev User must deposit usdc prior to calling this method
     */
    function openPosition(int256 intAmount) public override onlyRelayer {
        bool positionType = intAmount > 0 ? true : false;
        uint256 amount = _abs(intAmount);

        if (positionType) {
            _depositToVault(amount);
            _openPosition(amount, positionType);
        } else {
            _openPosition(amount, positionType);
            _withdrawFromPerp(amount);
        }

        emit PositionAdjusted(
            true, // open position
            positionType,
            amount
        );
    }

    /**
       @notice closePosition on perpetual
       @dev withdraw all collateral available from perpetual vault (usdt stays in the BB)
       @dev one can withdraw the amount up to your freeCollateral.
     */
    function closePosition(uint256 _amount) public override onlyRelayer {
        _closePosition(_amount);
        uint256 collateral = perpPortal.getFreeCollateral(address(this));
        _withdrawFromPerp(collateral);
        emit EmergencyClosed(msg.sender, collateral);
    }

    /**
     * @notice Update perpetual ref code
     * @param _code new code
     */
    function setPerpRefCode(bytes32 _code) public override onlyRelayer {
        perpReferralCode = _code;
    }

    /**
     * @notice
     * @param newVToken
     */
    function setPerpVToken(address newVToken) public override onlyRelayer {
        _setPerpVToken(IIndexPrice(newVToken));
    }

    /**
     *  @notice Get bb's Account Value
     */
    function getAccountValue() external view override returns (int256) {
        return perpPortal.getAccountValue(address(this));
    }

    /**
     *  @notice Check how much collateral a BB can withdraw
     */
    function getFreeCollateral() external view override returns (uint256) {
        return perpPortal.getFreeCollateral(address(this));
    }

    /**
     * @notice Price of underlying perpetual asset [1e6]
     */
    function getNativeStrategyTokenPrice()
        external
        view
        override
        returns (uint256)
    {
        // vBTC, vETH or other
        return vToken.getIndexPrice(perpPortal.getTwapInterval()) / 1e12;
    }

    function getTotalAbsPositionValue()
        external
        view
        override
        returns (uint256 value)
    {
        value = perpPortal.getTotalAbsPositionValue(address(this));
    }

    /**
     * @notice Strategy worth nominated in the USDC
     */
    function getTotalUSDCValue() external view override returns (uint256) {
        uint256 reserve = IERC20(currentUSDCToken).balanceOf(address(this));
        return
            _abs(perpPortal.getAccountValue(address(this))) /
            1e12 +
            reserve +
            Math.mulDiv(
                IERC20(wrappedNativeToken).balanceOf(address(this)),
                this.getNativeStrategyTokenPrice(),
                1e18
            );
    }

    /**
     * @notice if funding rate is more than 1 => long positions pays to short
     * vise versa otherwise, https://support.perp.com/hc/en-us/articles/5331299807513-Liquidation
     * @return fundingRate_10_6
     * @dev Current funding rate for the perpV2
     */
    function getCurrentFundingRate() external view override returns (uint256) {
        return
            Math.mulDiv(
                _getDailyMarketTwap(),
                1e18,
                this.getNativeStrategyTokenPrice()
            ) / 1e12;
    }

    /*
     *  @notice returns the value of the price of the underlying asset in USD in bp - [1e18]
     *  with TWAP(time-weighted average price) interval 900 (15 min) and ChainLink Price Oracle(source)
     *  @return perpPortal.getLiquidationPrice()
     */
    function getLiquidatePrice() public view override returns (uint256) {
        return perpPortal.getLiquidationPrice(address(this), address(vToken));
    }

    /*
     *  @notice Deposit prior to opening a position
     *  @param _amount decode:
     *  @param _positionType decode:
     *  @dev baseToken the address of the vETH; specifies which market you want to trade in
     */
    function _openPosition(uint256 _amount, bool _positionType)
        private
        returns (uint256)
    {
        IClearingHouse.OpenPositionParams memory params = IClearingHouse
            .OpenPositionParams({
                baseToken: address(vToken),
                isBaseToQuote: _positionType, // false for longing base token
                isExactInput: false, // specifying `exactInput` or `exactOutput uniV2
                amount: _amount,
                oppositeAmountBound: 0, // the restriction on how many token to receive/pay, depending on `isBaseToQuote` & `isExactInput`
                sqrtPriceLimitX96: 0, // 0 for no price limit
                deadline: block.timestamp + deadlineTime,
                referralCode: perpReferralCode
            });

        // quote is the amount of quote token taker pays
        // base is the amount of base token taker gets
        (uint256 base, ) = IClearingHouse(perpPortal.getClearingHouse())
            .openPosition(params);
        emit OpenPosition(address(vToken), _positionType, _amount);
        return base;
    }

    function _withdrawFromPerp(uint256 amount)
        private
        returns (uint256 _amount)
    {
        uint256 freeCollateral = perpPortal.getFreeCollateral(address(this));
        if (amount > freeCollateral) {
            IVault(perpPortal.getVault()).withdraw(
                currentUSDCToken,
                freeCollateral
            );
            _amount = freeCollateral;
        } else {
            IVault(perpPortal.getVault()).withdraw(currentUSDCToken, amount);
            _amount = amount;
        }
        emit Withdrawal(address(vToken), _amount);
    }

    /**
     * @dev Price of LONG asset [1e18]
     */
    function _getDailyMarketTwap() private view returns (uint256) {
        uint32 interval = perpPortal.getTwapInterval();
        uint160 dailyMarketTwap160X96 = perpPortal.getSqrtMarkTwapX96(
            address(vToken),
            interval
        );
        uint256 dailyMarketTwapX96 = Math.formatSqrtPriceX96ToPriceX96(
            dailyMarketTwap160X96
        );
        return Math.formatX96ToX10_18(dailyMarketTwapX96);
    }

    function _abs(int256 value) private pure returns (uint256) {
        return value >= 0 ? uint256(value) : uint256(-value);
    }

    function _depositToVault(uint256 _amount) private {
        IERC20(currentUSDCToken).approve(perpPortal.getVault(), _amount);
        IVault(perpPortal.getVault()).deposit(currentUSDCToken, _amount);
        emit USDCDeposited(_amount);
    }

    /**
     * @notice Close perpetual position
     * @param _amount the amount specified. this can be either the input amount or output amount.
     * @return true if transaction completed
     */
    function _closePosition(uint256 _amount) private returns (bool) {
        IClearingHouse(perpPortal.getClearingHouse()).closePosition(
            IClearingHouse.ClosePositionParams({
                baseToken: address(vToken),
                sqrtPriceLimitX96: 0,
                oppositeAmountBound: _amount,
                deadline: block.timestamp + deadlineTime,
                referralCode: perpReferralCode
            })
        );
        emit ClosePosition(address(vToken), _amount);
        return true;
    }

    function _setPerpVToken(IIndexPrice _vToken) private {
        vToken = _vToken;
    }
}
