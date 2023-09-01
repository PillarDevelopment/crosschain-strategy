// SPDX-License-Identifier: MIT

pragma solidity ^0.8.12;

import "../BaseBuildingBlock.sol";
import "../../interfaces/buildingBlocks/IAaveVault.sol";

/**
 * @author DeCommas team
 * @title Aave protocol interface to open, close positions and borrow assets
 */
contract AaveVault is BaseBuildingBlock, IAaveVault {
    IPoolAddressesProvider public aaveProvider;
    IPool public aaveLendingPool;
    IWETHGateway public wethGateway;
    IRewardsController public rewardsController;
    address public wavaxVariableDebtToken;
    address public aaveStrategy;

    /**
     * @notice Initializer
     * @param _data encode for:
     * @dev aaveProvider aave Pool provider address
     * @dev _wethGateway weth network gateway
     * @dev _rewardsController rewards controller address
     */
    function initialize(bytes memory _data) public initializer {
        AaveVaultInitParams memory initParams = abi.decode(
            _data,
            (AaveVaultInitParams)
        );

        require(
            address(initParams.aaveProviderAddress) != address(0),
            "AaveVault::initialize: aaveProvider address zero"
        );
        require(
            address(initParams.wethGatewayAddress) != address(0),
            "AaveVault::initialize: wethGateway address zero"
        );
        require(
            address(initParams.rewardsControllerAddress) != address(0),
            "AaveVault::initialize: rewardsController address zero"
        );
        require(
            address(initParams.relayerAddress) != address(0),
            "AaveVault::initialize: relayer address zero"
        );
        require(
            address(initParams.usdcToken) != address(0),
            "AaveVault::initialize: usdc address zero"
        );
        require(
            address(initParams.aaveStrategy) != address(0),
            "AaveVault::initialize: aaveStrategy address zero"
        );
        require(
            address(initParams.wavaxVariableDebtTokenAddress) != address(0),
            "AaveVault::initialize: wavaxVDebtToken address zero"
        );
        require(
            initParams.nativeId > 0,
            "AaveVault::initialize: id must be greater than 0"
        );
        require(
            address(initParams.dcNativeRouter) != address(0),
            "AaveVault::initialize: dcNativeRouter address zero"
        );

        __Ownable_init();
        _transferOwnership(_msgSender());

        nativeChainId = initParams.nativeId;
        nativeRouter = initParams.dcNativeRouter;
        currentUSDCToken = address(initParams.usdcToken);
        deCommasRelayerAddress = address(initParams.relayerAddress);

        aaveProvider = initParams.aaveProviderAddress;
        aaveLendingPool = IPool(aaveProvider.getPool());
        wethGateway = initParams.wethGatewayAddress;
        rewardsController = initParams.rewardsControllerAddress;
        aaveStrategy = initParams.aaveStrategy;
        wavaxVariableDebtToken = initParams.wavaxVariableDebtTokenAddress;
    }

    /**
     * @notice only access from strategy contract to pull funds
     * @param _asset  asset to transfer
     * @param _amount  amount to transfer
     */
    function transferToStrategy(address _asset, uint256 _amount)
        public
        override
        onlyStrategy
    {
        if (_asset == address(0x0)) {
            (bool sent, ) = address(aaveStrategy).call{value: _amount}("");
            require(
                sent,
                "AaveVault::transferToStrategy: native transfer failed"
            );
        } else {
            require(
                IERC20(_asset).transfer(aaveStrategy, _amount),
                "AaveVault::transferToStrategy: ERC20 transfer failed"
            );
        }
    }

    /**
     * @notice Allows a user to use the protocol in eMode
     * @param categoryId categoryId The id of the category
     * @dev id (0 - 255) defined by Risk or Pool Admins. categoryId == 0 ⇒ non E-mode category.
     */
    function setUserEMode(uint8 categoryId) public override onlyRelayer {
        aaveLendingPool.setUserEMode(categoryId);
        emit SetUserEMode(categoryId);
    }

    /**
     * @notice Sets a an asset already deposited as collateral for a future borrow
     * @dev Supply collateral first, then setCollateralAsset
     * @param collateralAsset collateral Asset address
     */
    function setCollateralAsset(address collateralAsset)
        public
        override
        onlyRelayer
    {
        if (collateralAsset == address(0)) {
            collateralAsset = wethGateway.getWETHAddress();
        }
        aaveLendingPool.setUserUseReserveAsCollateral(
            address(collateralAsset),
            true
        );
        emit SetCollateralEvent(IERC20(collateralAsset));
    }

    /**
     * @notice Opens a new position (supply collateral) as liquidity provider on AAVE
     * @param baseAsset baseAsset asset address, amount to deposit
     */
    function openPosition(
        IERC20 baseAsset,
        uint256 amount,
        uint16 referralCode
    ) public override onlyRelayer {
        if (address(baseAsset) == address(0x0)) {
            require(
                amount <= address(this).balance,
                "AaveVault::openPosition: amount greater than native balance"
            );
            wethGateway.depositETH{value: amount}(
                address(aaveLendingPool),
                address(this),
                referralCode
            );
        } else {
            require(
                amount <= baseAsset.balanceOf(address(this)),
                "AaveVault::openPosition: amount greater than baseAsset balance"
            );
            baseAsset.approve(address(aaveLendingPool), amount);

            aaveLendingPool.supply(
                address(baseAsset),
                amount,
                address(this),
                referralCode
            );
        }

        emit OpenPositionEvent(baseAsset, amount);
    }

    /**
     * @notice Aave Borrows an asset
     * @param borrowAsset baseAsset address, amount to borrow
     */
    function borrow(
        IERC20 borrowAsset,
        uint256 amount,
        uint16 borrowRate,
        uint16 referralCode
    ) public override onlyRelayer {
        if (address(borrowAsset) == address(0x0)) {
            IDebtTokenBase(wavaxVariableDebtToken).approveDelegation(
                address(wethGateway),
                amount
            );
            wethGateway.borrowETH(
                address(aaveLendingPool),
                amount,
                borrowRate,
                referralCode
            );
        } else {
            aaveLendingPool.borrow(
                address(borrowAsset),
                amount,
                borrowRate,
                referralCode,
                address(this)
            );
        }
        emit BorrowEvent(borrowAsset, amount);
    }

    /**
     * @notice Repays a loan (partially or fully)
     * @dev using default Fixed rates
     */
    function repay(
        IERC20 asset,
        uint256 amount,
        uint16 borrowRate
    ) public override onlyRelayer {
        if (address(asset) == address(0x0)) {
            wethGateway.repayETH{value: amount}(
                address(aaveLendingPool),
                amount,
                borrowRate,
                address(this)
            );
        } else {
            asset.approve(address(aaveLendingPool), amount);
            aaveLendingPool.repay(
                address(asset),
                amount,
                borrowRate,
                address(this)
            );
        }
        emit RepayEvent(asset, amount);
    }

    /**
     * @notice Closes a position as liquidity provider on AAVE
     * @param asset asset address,amount to withdraw
     * @dev if asset[0] List of incentivized assets to check eligible distributions, The address of the user
     */
    function closePosition(IERC20 asset, uint256 amount)
        public
        override
        onlyRelayer
    {
        if (address(asset) == address(0x0)) {
            wethGateway.withdrawETH(
                address(aaveLendingPool),
                amount,
                address(this)
            );
        } else {
            aaveLendingPool.withdraw(address(asset), amount, address(this));
        }
        emit ClosePositionEvent(asset, amount);
    }

    /**
     * @notice Returns a list all rewards of a user, including already accrued and unrealized claimable rewards
     * @param assets List of incentivized assets to check eligible distributions, The address of the user
     **/
    function claimAllRewards(address[] memory assets, address user)
        public
        override
        onlyRelayer
    {
        rewardsController.claimAllRewards(assets, user);
        emit ClaimedRewardsEvent(assets, user);
    }

    modifier onlyStrategy() {
        require(
            msg.sender == deCommasRelayerAddress || msg.sender == aaveStrategy,
            "AaveVault::onlyStrategy:Only strategy or relayer"
        );
        _;
    }
}
