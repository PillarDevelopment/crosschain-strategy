const {ethers, network, upgrades} = require("hardhat");
const {expect} = require("chai");
const {expectRevert, ether} = require("@openzeppelin/test-helpers");
const {getMock} = require("../../utils/mock_utils");
const {BigNumber} = require("ethers");
const { smock } = require('@defi-wonderland/smock');
const chai = require("chai");

chai.use(smock.matchers);

const NATIVE_CHAIN_ID = 1;

describe("Aave Vault unit test", function () {
    let accounts;
    let aaveVaultFactory;
    let relayer, dcRouter, aaveStrategy, lendingPool, aaveRewardsController, poolAddressProvider, wethGateway;
    let usdc, wavax, link, wbtc, uniswapRouter, weth;
    let aToken, rewardToken, debToken;
    let fakePool, forbiddenUser;

    before(async function () {
        accounts = await ethers.getSigners();
        relayer = accounts[0];
        fakePool = accounts[1];
        forbiddenUser = accounts[2];
        dcRouter = accounts[3];

        const tokenFactory = await smock.mock('ERC20Mock');
        const debTokenFactory = await ethers.getContractFactory("DebtTokenMock");
        const aaveLendingPoolFactory = await ethers.getContractFactory("AavePoolMock");
        const uniswapRouterFactory = await ethers.getContractFactory("UniswapRouterV2Mock");
        const strategyFactory = await ethers.getContractFactory("AaveStrategy");

        usdc = await tokenFactory.deploy("usdc");
        wavax = await tokenFactory.deploy("wavax");
        weth = await tokenFactory.deploy("weth");
        link = await tokenFactory.deploy("link");
        wbtc = await tokenFactory.deploy("wbtc");
        aToken = await tokenFactory.deploy("aToken");
        rewardToken = await tokenFactory.deploy("rewardToken");
        debToken = await debTokenFactory.deploy();
        uniswapRouter = await uniswapRouterFactory.deploy(weth.address, wavax.address);
        lendingPool = await aaveLendingPoolFactory.deploy(aToken.address, rewardToken.address);
        aaveRewardsController = await getMock(relayer, "IRewardsController");
        wethGateway = await getMock(relayer, "IWETHGateway");
        poolAddressProvider = await getMock(relayer, "IPoolAddressesProvider");
        aaveStrategy = await strategyFactory.deploy();

        await poolAddressProvider.mock.getPool.returns(lendingPool.address);

        await link.mint(lendingPool.address, BigNumber.from(String(ether("100"))));
        await link.mint(uniswapRouter.address, BigNumber.from(String(ether("100"))));
        await wbtc.mint(lendingPool.address, BigNumber.from(String(ether("100"))));
        await wbtc.mint(uniswapRouter.address, BigNumber.from(String(ether("100"))));
        await usdc.mint(uniswapRouter.address, BigNumber.from(String(ether("100"))));

        aaveVaultFactory = await ethers.getContractFactory("AaveVault");
    });

    function getVaultInitParams(
        {
            aaveProviderAddress = ethers.constants.AddressZero,
            wethGatewayAddress = ethers.constants.AddressZero,
            rewardsControllerAddress = ethers.constants.AddressZero,
            relayerAddress = ethers.constants.AddressZero,
            usdcToken = ethers.constants.AddressZero,
            aaveStrategy = ethers.constants.AddressZero,
            wavaxVariableDebtToken = ethers.constants.AddressZero,
            nativeId = NATIVE_CHAIN_ID,
            dcNativeRouter = ethers.constants.AddressZero,
        }
    ) {
        return ethers.utils.defaultAbiCoder.encode(
            [
                "address",
                "address",
                "address",
                "address",
                "address",
                "address",
                "address",
                "uint16",
                "address",
            ],
            [
                aaveProviderAddress,
                wethGatewayAddress,
                rewardsControllerAddress,
                relayerAddress,
                usdcToken,
                aaveStrategy,
                wavaxVariableDebtToken,
                nativeId,
                dcNativeRouter,
            ]
        );
    }

    describe("initialize", function () {
        let snapshotId;
        let aaveVault;

        before(async function () {
            aaveVault = await aaveVaultFactory.deploy();
        });

        beforeEach(async function () {
            snapshotId = await network.provider.request({
                method: "evm_snapshot",
                params: [],
            });
        });

        afterEach(async function () {
            await network.provider.request({
                method: "evm_revert",
                params: [snapshotId],
            });
        });

        it("should revert when poolAddressProvider address is zero", async function () {
            const initParams = getVaultInitParams({
                wethGatewayAddress: lendingPool.address,
                rewardsControllerAddress: lendingPool.address,
                relayerAddress: lendingPool.address,
                usdcToken: lendingPool.address,
                aaveStrategy: lendingPool.address,
                wavaxVariableDebtToken: lendingPool.address,
                dcNativeRouter: dcRouter.address,
            });
            await expectRevert(aaveVault.initialize(initParams),
                "AaveVault::initialize: aaveProvider address zero"
            );
        });

        it("should revert when wethGateway address is zero", async function () {
            const initParams = getVaultInitParams({
                aaveProviderAddress: lendingPool.address,
                rewardsControllerAddress: lendingPool.address,
                relayerAddress: lendingPool.address,
                usdcToken: lendingPool.address,
                aaveStrategy: lendingPool.address,
                wavaxVariableDebtToken: lendingPool.address,
                dcNativeRouter: dcRouter.address,
            });
            await expectRevert(aaveVault.initialize(initParams),
                "AaveVault::initialize: wethGateway address zero"
            );
        });

        it("should revert when rewards controller address is zero", async function () {
            const initParams = getVaultInitParams({
                aaveProviderAddress: lendingPool.address,
                wethGatewayAddress: lendingPool.address,
                relayerAddress: lendingPool.address,
                usdcToken: lendingPool.address,
                aaveStrategy: lendingPool.address,
                wavaxVariableDebtToken: lendingPool.address,
                dcNativeRouter: dcRouter.address,
            });
            await expectRevert(aaveVault.initialize(initParams),
                "AaveVault::initialize: rewardsController address zero"
            );
        });

        it("should revert when relayer address is zero", async function () {
            const initParams = getVaultInitParams({
                aaveProviderAddress: lendingPool.address,
                wethGatewayAddress: lendingPool.address,
                rewardsControllerAddress: lendingPool.address,
                usdcToken: lendingPool.address,
                aaveStrategy: lendingPool.address,
                wavaxVariableDebtToken: lendingPool.address,
                dcNativeRouter: dcRouter.address,
            });
            await expectRevert(aaveVault.initialize(initParams),
                "AaveVault::initialize: relayer address zero"
            );
        });

        it("should revert when usdc address is zero", async function () {
            const initParams = getVaultInitParams({
                aaveProviderAddress: lendingPool.address,
                wethGatewayAddress: lendingPool.address,
                rewardsControllerAddress: lendingPool.address,
                relayerAddress: lendingPool.address,
                aaveStrategy: lendingPool.address,
                wavaxVariableDebtToken: lendingPool.address,
                dcNativeRouter: dcRouter.address,
            });
            await expectRevert(aaveVault.initialize(initParams),
                "AaveVault::initialize: usdc address zero"
            );
        });

        it("should revert when aave strategy address is zero", async function () {
            const initParams = getVaultInitParams({
                aaveProviderAddress: lendingPool.address,
                wethGatewayAddress: lendingPool.address,
                rewardsControllerAddress: lendingPool.address,
                relayerAddress: lendingPool.address,
                lzEndpointAddress: lendingPool.address,
                usdcToken: lendingPool.address,
                wavaxVariableDebtToken: lendingPool.address,
                dcNativeRouter: dcRouter.address,
            });
            await expectRevert(aaveVault.initialize(initParams),
                "AaveVault::initialize: aaveStrategy address zero"
            );
        });

        it("should revert when wavaxVDebtToken address is zero", async function () {
            const initParams = getVaultInitParams({
                aaveProviderAddress: lendingPool.address,
                wethGatewayAddress: lendingPool.address,
                rewardsControllerAddress: lendingPool.address,
                relayerAddress: lendingPool.address,
                usdcToken: lendingPool.address,
                aaveStrategy: lendingPool.address,
                dcNativeRouter: dcRouter.address,
            });
            await expectRevert(aaveVault.initialize(initParams),
                "AaveVault::initialize: wavaxVDebtToken address zero"
            );
        });

        it("should revert when aaveProvider address is invalid", async function () {
            const initParams = getVaultInitParams({
                wethGatewayAddress: lendingPool.address,
                rewardsControllerAddress: lendingPool.address,
                relayerAddress: lendingPool.address,
                usdcToken: lendingPool.address,
                aaveStrategy: lendingPool.address,
                wavaxVariableDebtToken: lendingPool.address,
                dcNativeRouter: dcRouter.address,
            });
            await expectRevert.unspecified(aaveVault.initialize(initParams));
        });

        it("should revert when chainId is less than 1", async function () {
            const initParams = getVaultInitParams({
                aaveProviderAddress: lendingPool.address,
                wethGatewayAddress: lendingPool.address,
                rewardsControllerAddress: lendingPool.address,
                relayerAddress: lendingPool.address,
                usdcToken: lendingPool.address,
                aaveStrategy: aaveStrategy.address,
                wavaxVariableDebtToken: lendingPool.address,
                nativeId: 0,
                dcNativeRouter: dcRouter.address,
            });
            await expectRevert(aaveVault.initialize(initParams),
                "'AaveVault::initialize: id must be greater than 0"
            );
        });

        it("should revert when dcRouter address is zero", async function () {
            const initParams = getVaultInitParams({
                aaveProviderAddress: lendingPool.address,
                wethGatewayAddress: lendingPool.address,
                rewardsControllerAddress: lendingPool.address,
                relayerAddress: lendingPool.address,
                usdcToken: lendingPool.address,
                aaveStrategy: lendingPool.address,
                wavaxVariableDebtToken: lendingPool.address,
            });
            await expectRevert(aaveVault.initialize(initParams),
                "AaveVault::initialize: dcNativeRouter address zero"
            );
        });

        it("constructor should success", async function () {
            const initParams = getVaultInitParams({
                aaveProviderAddress: poolAddressProvider.address,
                wethGatewayAddress: wethGateway.address,
                rewardsControllerAddress: aaveRewardsController.address,
                relayerAddress: relayer.address,
                usdcToken: usdc.address,
                aaveStrategy: lendingPool.address,
                wavaxVariableDebtToken: wavax.address,
                dcNativeRouter: dcRouter.address,
            });
            expect(aaveVault.initialize(initParams)).not.to.be.reverted;
        });
    });

    describe("upgradability", function () {
        let snapshotId;

        beforeEach(async function () {
            snapshotId = await network.provider.request({
                method: "evm_snapshot",
                params: [],
            });
        });

        afterEach(async function () {
            await network.provider.request({
                method: "evm_revert",
                params: [snapshotId],
            });
        });

        it("should forbid double init", async function () {
            const initParams = getVaultInitParams({
                aaveProviderAddress: poolAddressProvider.address,
                wethGatewayAddress: wethGateway.address,
                rewardsControllerAddress: aaveRewardsController.address,
                relayerAddress: fakePool.address,
                usdcToken: usdc.address,
                aaveStrategy: aaveStrategy.address,
                wavaxVariableDebtToken: wavax.address,
                dcNativeRouter: dcRouter.address,
            });
            const aaveVault = await aaveVaultFactory.deploy();
            await aaveVault.initialize(initParams);
            await expect(aaveVault.initialize(initParams)).to.be.reverted;
        });

        it("should forbid upgrade from not owner", async function () {
            const initParams = getVaultInitParams({
                aaveProviderAddress: poolAddressProvider.address,
                wethGatewayAddress: wethGateway.address,
                rewardsControllerAddress: aaveRewardsController.address,
                relayerAddress: fakePool.address,
                usdcToken: usdc.address,
                aaveStrategy: aaveStrategy.address,
                wavaxVariableDebtToken: wavax.address,
                dcNativeRouter: dcRouter.address,
            });

            const aaveVaultUpgradeable = await upgrades.deployProxy(aaveVaultFactory,[initParams]);
            await aaveVaultUpgradeable.deployed();

            const aaveVaultNew = await aaveVaultFactory.deploy();

            await expect(
                aaveVaultUpgradeable.connect(forbiddenUser).upgradeTo(aaveVaultNew.address)
            ).to.be.revertedWith("'Ownable: caller is not the owner");
        });

        it("should allow upgrade from owner", async function () {
            const initParams = getVaultInitParams({
                aaveProviderAddress: poolAddressProvider.address,
                wethGatewayAddress: wethGateway.address,
                rewardsControllerAddress: aaveRewardsController.address,
                relayerAddress: fakePool.address,
                usdcToken: usdc.address,
                aaveStrategy: aaveStrategy.address,
                wavaxVariableDebtToken: wavax.address,
                dcNativeRouter: dcRouter.address,
            });

            const aaveVaultUpgradeable = await upgrades.deployProxy(aaveVaultFactory,[initParams]);
            await aaveVaultUpgradeable.deployed();

            const aaveVaultNew = await aaveVaultFactory.deploy();

            await expect(
                aaveVaultUpgradeable.upgradeTo(aaveVaultNew.address)
            ).not.to.be.reverted;
        });
    });

    describe("getters", function () {
        let snapshotId;
        let aaveVault;

        before(async function () {
            aaveVault = await aaveVaultFactory.deploy();
        });

        beforeEach(async function () {
            snapshotId = await network.provider.request({
                method: "evm_snapshot",
                params: [],
            });
        });

        before(async function () {
            const initParams = getVaultInitParams({
                aaveProviderAddress: poolAddressProvider.address,
                wethGatewayAddress: wethGateway.address,
                rewardsControllerAddress: aaveRewardsController.address,
                relayerAddress: relayer.address,
                usdcToken: usdc.address,
                aaveStrategy: aaveStrategy.address,
                wavaxVariableDebtToken: debToken.address,
                dcNativeRouter: dcRouter.address,
            });
            await aaveVault.initialize(initParams);
        });

        afterEach(async function () {
            await network.provider.request({
                method: "evm_revert",
                params: [snapshotId],
            });
        });

        it("should get aaveProvider", async function () {
            const provider = await aaveVault.aaveProvider();
            expect(provider).to.equal(poolAddressProvider.address);
        });

        it("should get aaveLendingPool", async function () {
            const pool = await aaveVault.aaveLendingPool();
            expect(pool).to.equal(lendingPool.address);
        });

        it("should get wethGateway", async function () {
            const gateway = await aaveVault.wethGateway();
            expect(gateway).to.equal(wethGateway.address);
        });

        it("should get rewardsController", async function () {
            const rewardController = await aaveVault.rewardsController();
            expect(rewardController).to.equal(aaveRewardsController.address);
        });

        it("should get nativeRouter", async function () {
            const nativeRouter = await aaveVault.nativeRouter();
            expect(nativeRouter).to.equal(dcRouter.address);
        });

        it("should get wavaxVariableDebtToken", async function () {
            const wavaxVariableDebtToken = await aaveVault.wavaxVariableDebtToken();
            expect(wavaxVariableDebtToken).to.equal(debToken.address);
        });

        it("should get aaveStrategy", async function () {
            const strategy = await aaveVault.aaveStrategy();
            expect(strategy).to.equal(aaveStrategy.address);
        });
    });

    describe("Transfer to strategy", function () {
        let snapshotId;
        let aaveVault;

        before(async function () {
            aaveVault = await aaveVaultFactory.deploy();

            const initParams = getVaultInitParams({
                aaveProviderAddress: poolAddressProvider.address,
                wethGatewayAddress: wethGateway.address,
                rewardsControllerAddress: aaveRewardsController.address,
                relayerAddress: fakePool.address,
                usdcToken: usdc.address,
                aaveStrategy: aaveStrategy.address,
                wavaxVariableDebtToken: wavax.address,
                dcNativeRouter: dcRouter.address,
            });
            await aaveVault.initialize(initParams);
        });


        beforeEach(async function () {
            snapshotId = await network.provider.request({
                method: "evm_snapshot",
                params: [],
            });
        });

        afterEach(async function () {
            await network.provider.request({
                method: "evm_revert",
                params: [snapshotId],
            });
        });

        it("should transfer usdc", async function () {
            const transferAmount = BigNumber.from(ether("10").toString());
            await usdc.mint(aaveVault.address, ether("100").toString());
            let vaultBalance = await usdc.balanceOf(aaveVault.address);
            await aaveVault.connect(fakePool).transferToStrategy(usdc.address, transferAmount.toString());
            let vaultBalanceAfterTransfer = await usdc.balanceOf(aaveVault.address);
            expect(vaultBalanceAfterTransfer.toString()).to.equal(vaultBalance.sub(transferAmount).toString());
            let strategyBalance = await usdc.balanceOf(aaveStrategy.address);
            expect(strategyBalance.toString()).to.equal(transferAmount.toString());
        });

        it("should fail to transfer bad token", async function () {
            await usdc.mint(aaveVault.address, ether("100").toString());
            await usdc.transfer.returns(false);
            await expect(
                aaveVault.connect(fakePool).transferToStrategy(usdc.address, ether("1").toString())
            ).to.be.revertedWith("AaveVault::transferToStrategy: ERC20 transfer");
            await usdc.transfer.reset();
        });

        it("should transfer native", async function () {
            const transferAmount = BigNumber.from(ether("1").toString());
            await fakePool.sendTransaction({
                to: aaveVault.address,
                value: transferAmount,
                gasLimit: 80000
            });
            const strategyInitParams = ethers.utils.defaultAbiCoder.encode(
                [
                    "address",
                    "address",
                    "address",
                ],
                [
                    fakePool.address,
                    aaveVault.address,
                    dcRouter.address,
                ]
            );
            await aaveStrategy.initialize(strategyInitParams);

            const vaultBalance = await ethers.provider.getBalance(aaveVault.address);
            expect(vaultBalance).to.equal(transferAmount);
            await aaveVault.connect(fakePool).transferToStrategy(ethers.constants.AddressZero, transferAmount.toString());
            const vaultBalanceAfterTransfer = await ethers.provider.getBalance(aaveVault.address);
            expect(vaultBalanceAfterTransfer.toString()).to.equal(vaultBalance.sub(transferAmount).toString());
            let strategyBalance = await ethers.provider.getBalance(aaveStrategy.address);
            expect(strategyBalance.toString()).to.equal(transferAmount.toString());
        });

        it("should fail to transfer native on low balance", async function () {
            const strategyInitParams = ethers.utils.defaultAbiCoder.encode(
                [
                    "address",
                    "address",
                    "address",
                ],
                [
                    fakePool.address,
                    aaveVault.address,
                    dcRouter.address,
                ]
            );
            await aaveStrategy.initialize(strategyInitParams);

            await expect(
                aaveVault.connect(fakePool).transferToStrategy(ethers.constants.AddressZero, ether("1").toString())
            ).to.be.revertedWith("AaveVault::transferToStrategy: native transfer");
        });
    });

    describe("auth modifiers", function () {
        let snapshotId;
        let aaveVault;

        before(async function () {
            aaveVault = await aaveVaultFactory.deploy();

            const initParams = getVaultInitParams({
                aaveProviderAddress: poolAddressProvider.address,
                wethGatewayAddress: wethGateway.address,
                rewardsControllerAddress: aaveRewardsController.address,
                relayerAddress: fakePool.address,
                usdcToken: usdc.address,
                aaveStrategy: aaveStrategy.address,
                wavaxVariableDebtToken: wavax.address,
                dcNativeRouter: dcRouter.address,
            });
            await aaveVault.initialize(initParams);
        });

        beforeEach(async function () {
            snapshotId = await network.provider.request({
                method: "evm_snapshot",
                params: [],
            });
        });

        afterEach(async function () {
            await network.provider.request({
                method: "evm_revert",
                params: [snapshotId],
            });
        });

        it("should forbid transferToStrategy", async function () {
            const tx = aaveVault.connect(forbiddenUser).transferToStrategy(usdc.address, ether("1").toString());
            await expect(tx).to.be.revertedWith("AaveVault::onlyStrategy:Only strategy or relayer");
        });

        it("should forbid setUserEMode", async function () {
            const tx = aaveVault.connect(forbiddenUser).setUserEMode("0xff");
            await expect(tx).to.be.revertedWith("BaseAppStorage:Only relayer");
        });

        it("should forbid setCollateralAsset", async function () {
            const tx = aaveVault.connect(forbiddenUser).setCollateralAsset(usdc.address);
            await expect(tx).to.be.revertedWith("BaseAppStorage:Only relayer");
        });

        it("should forbid openPosition", async function () {
            const tx = aaveVault.connect(forbiddenUser).openPosition(usdc.address, 100, 0);
            await expect(tx).to.be.revertedWith("BaseAppStorage:Only relayer");
        });

        it("should forbid repay", async function () {
            const tx = aaveVault.connect(forbiddenUser).repay(usdc.address, 100, 0);
            await expect(tx).to.be.revertedWith("BaseAppStorage:Only relayer");
        });

        it("should forbid closePosition", async function () {
            const tx = aaveVault.connect(forbiddenUser).closePosition(usdc.address, "100");
            await expect(tx).to.be.revertedWith("BaseAppStorage:Only relayer");
        });

        it("should forbid claimAllRewards", async function () {
            const tx = aaveVault.connect(forbiddenUser).claimAllRewards([usdc.address], forbiddenUser.address);
            await expect(tx).to.be.revertedWith("BaseAppStorage:Only relayer");
        });
    });
});
