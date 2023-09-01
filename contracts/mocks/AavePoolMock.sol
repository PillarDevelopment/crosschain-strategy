// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.12;

import "./ERC20Mock.sol";
import "../integrations/aave/v3/IPool.sol";

import "hardhat/console.sol";

contract AavePoolMock {
    ERC20Mock public aToken;
    ERC20Mock public rewardToken;

    mapping(address => uint8) public userMode;
    mapping(address => uint256) public userConfig;
    uint256 public rewards;
    address public collateralType;
    mapping(address => uint256) collaterals;
    address public reserveAsset;

    constructor(address _aToken, address _rewardToken) {
        aToken = ERC20Mock(_aToken);
        rewardToken = ERC20Mock(_rewardToken);
    }

    fallback() external payable {}

    receive() external payable {}

    function getPriceOracle() public view returns (address) {
        return address(this);
    }

    function getAssetPrice(address) external pure returns (uint256) {
        return 1 ether;
    }

    function getUserAccountData(address)
        external
        pure
        returns (
            uint256 totalCollateralBase,
            uint256 totalDebtBase,
            uint256 availableBorrowsBase,
            uint256 currentLiquidationThreshold,
            uint256 ltv,
            uint256 healthFactor
        )
    {
        totalCollateralBase = 1 ether;
        totalDebtBase = 1 ether;
        availableBorrowsBase = 1 ether;
        currentLiquidationThreshold = 1 ether;
        ltv = 1 ether;
        healthFactor = 1 ether;
    }

    function getPool() public view returns (address) {
        return address(this);
    }

    function setUserEMode(uint8 _userMode) public {
        userMode[msg.sender] = _userMode;
    }

    function setUserUseReserveAsCollateral(address _token, bool) public {
        collateralType = _token;
    }

    function depositETH(
        address pool,
        address onBehalfOf,
        uint16 referralCode
    ) external payable {}

    function withdrawETH(
        address,
        uint256 amount,
        address
    ) external {
        require(
            address(this).balance >= amount,
            "AAVE MOCK:withdrawETH: insufficient amount"
        );
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "AAVE MOCK:withdrawETH:low level call failed");
    }

    function repayETH(
        address pool,
        uint256 amount,
        uint256 rateMode,
        address onBehalfOf
    ) external payable {}

    function borrowETH(
        address,
        uint256 amount,
        uint256,
        uint16
    ) external {
        require(
            address(this).balance >= amount,
            "AAVE MOCK:borrowETH: insufficient amount"
        );
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "AAVE MOCK:borrowETH:low level call failed");
    }

    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16
    ) external {
        require(
            ERC20Mock(asset).transferFrom(msg.sender, address(this), amount),
            "AAVE MOCK:supply: transfer failed"
        );

        collaterals[asset] += amount;
        aToken.mint(onBehalfOf, amount);
        rewards += amount;
    }

    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256) {
        require(
            collaterals[asset] >= amount,
            "AAVE MOCK:withdraw: insufficient amount"
        );
        collaterals[asset] -= amount;
        ERC20Mock(asset).transfer(to, amount);

        return amount;
    }

    function borrow(
        address asset,
        uint256 amount,
        uint256,
        uint16,
        address onBehalfOf
    ) external {
        uint256 balance = ERC20Mock(asset).balanceOf(address(this));
        require(balance >= amount, "AAVE MOCK:borrow->: insufficient amount");
        ERC20Mock(asset).transfer(onBehalfOf, amount);
    }

    function repay(
        address asset,
        uint256 amount,
        uint256,
        address onBehalfOf
    ) external returns (uint256) {
        require(ERC20Mock(asset).balanceOf(onBehalfOf) >= amount);
        ERC20Mock(asset).transferFrom(onBehalfOf, address(this), amount);
        collaterals[asset] += amount;
        return collaterals[asset];
    }

    function claimAllRewards(address[] calldata, address)
        external
        returns (address[] memory rewardsList, uint256[] memory claimedAmounts)
    {
        rewardsList = new address[](1);
        claimedAmounts = new uint256[](1);
        rewardsList[0] = address(rewardToken);
        claimedAmounts[0] = rewards;
        rewards = 0;
    }

    function getReservesList() external view returns (address[] memory) {
        if (reserveAsset == address(0)) {
            return new address[](0);
        }
        address[] memory reserves = new address[](1);
        reserves[0] = reserveAsset;
        return reserves;
    }

    function setReserveAsset(address _asset) external {
        reserveAsset = _asset;
    }

    function getUserConfiguration(address user)
        external
        view
        returns (DataTypes.UserConfigurationMap memory)
    {
        return DataTypes.UserConfigurationMap({data: userConfig[user]});
    }

    function setUserConfiguration(address _user, uint256 config) external {
        userConfig[_user] = config;
    }

    function getUserEMode(address user) external view returns (uint256) {
        return userMode[user];
    }
}
