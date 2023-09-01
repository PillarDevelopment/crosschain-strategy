const {expectRevert} = require("@openzeppelin/test-helpers");
const {ethers, network} = require("hardhat");
const {expect} = require("chai");

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

describe("Aave Strategy Unit test", function () {
    let accounts, signer1;
    let relayer, dcRouter, aaveVault, aaveStrategy, lendingPool, uniswapRouter;
    let usdc, wavax, weth, aToken, rewardToken, debToken;

    before(async function () {
        accounts = await ethers.getSigners();
        relayer = accounts[0];
        signer1 = accounts[1];
        dcRouter = accounts[2];

        const aaveVaultFactory = await ethers.getContractFactory("AaveVault");
        const aaveStrategyFactory = await ethers.getContractFactory("AaveStrategy");
        const tokenFactory = await ethers.getContractFactory("ERC20Mock");
        const debTokenFactory = await ethers.getContractFactory("DebtTokenMock");
        const aaveLendingPoolFactory = await ethers.getContractFactory("AavePoolMock");
        const uniswapRouterFactory = await ethers.getContractFactory("UniswapRouterV2Mock");

        usdc = await tokenFactory.deploy("usdc");
        wavax = await tokenFactory.deploy("wavax");
        weth = await tokenFactory.deploy("weth");
        aToken = await tokenFactory.deploy("aToken");
        rewardToken = await tokenFactory.deploy("rewardToken");
        debToken = await debTokenFactory.deploy();
        uniswapRouter = await uniswapRouterFactory.deploy(weth.address, wavax.address);
        lendingPool = await aaveLendingPoolFactory.deploy(aToken.address, rewardToken.address);

        aaveStrategy = await aaveStrategyFactory.deploy();
        aaveVault = await aaveVaultFactory.deploy();
        const initParams = ethers.utils.defaultAbiCoder.encode(
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
                lendingPool.address,
                lendingPool.address,
                lendingPool.address,
                relayer.address,
                usdc.address,
                aaveStrategy.address,
                debToken.address,
                1,
                dcRouter.address,
            ]
        );
        await aaveVault.initialize(initParams);

        const initStrategyParams = ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "address"],
            [
                relayer.address,
                uniswapRouter.address,
                dcRouter.address,
            ]
        );
        await aaveStrategy.initialize(initStrategyParams);
    });

    describe("initialize and getters", function () {
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

        it("should get params", async function () {
            const ap = await aaveStrategy.deCommasRelayerAddress();
            const uni = await aaveStrategy.uniswapV2Router();
            const nativeRouter = await aaveStrategy.nativeRouter();

            expect(ap.toString()).to.equal(relayer.address);
            expect(uni.toString()).to.equal(uniswapRouter.address);
            expect(nativeRouter.toString()).to.equal(dcRouter.address);
        });

        it("should revert with AaveStrategy::swap::relayer", async function () {
            await expectRevert(
                aaveStrategy.connect(signer1).swap(aaveVault.address,
                    0,
                    0,
                    [ZERO_ADDRESS],
                    0),
                "BaseAppStorage:Only relayer");
            // Expect revert because of invalid params. Access already checked
            await expectRevert(
                aaveStrategy.connect(relayer).swap(aaveVault.address,
                    0,
                    0,
                    [ZERO_ADDRESS],
                    0),
                "AaveStrategy::swap: wrong amountIn");
        });

        it("should revert with AaveStrategy::intialize: address zero", async function () {
            const aaveStrategyFactory = await ethers.getContractFactory("AaveStrategy");
            const aaveStrategyZero = await aaveStrategyFactory.deploy();

            let initStrategyParams = ethers.utils.defaultAbiCoder.encode(
                ["address", "address", "address"],
                [
                    relayer.address,
                    ZERO_ADDRESS,
                    dcRouter.address,
                ]
            );
            await expectRevert(aaveStrategyZero.initialize(initStrategyParams), "AaveStrategy::initialize: uniswapRouter address zero");

            initStrategyParams = ethers.utils.defaultAbiCoder.encode(
                ["address", "address", "address"],
                [
                    ZERO_ADDRESS,
                    uniswapRouter.address,
                    dcRouter.address,
                ]
            );
            await expectRevert(aaveStrategyZero.initialize(initStrategyParams), "AaveStrategy::initialize: relayer address zero");

            initStrategyParams = ethers.utils.defaultAbiCoder.encode(
                ["address", "address", "address"],
                [
                    relayer.address,
                    uniswapRouter.address,
                    ZERO_ADDRESS,
                ]
            );
            await expectRevert(aaveStrategyZero.initialize(initStrategyParams), "AaveStrategy::initialize: dcNativeRouter address zero");

        });
    });

    describe("Uniswap Router setter", function () {
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

        it("should revert when set not by owner", async function () {
            await expect(
                aaveStrategy.connect(signer1).setUniswapRouter(uniswapRouter.address)
            ).to.be.revertedWith('Ownable: caller is not the owner');
        });

        it("should revert when set invalid address", async function () {
            await expect(
                aaveStrategy.connect(relayer).setUniswapRouter(ethers.constants.AddressZero)
            ).to.be.revertedWith('AaveStrategy::setUniswapRouter: address zero');
        });

        it("should set new router", async function () {
            const uniswapRouterFactory = await ethers.getContractFactory("UniswapRouterV2Mock");
            const uniswapRouter2 = await uniswapRouterFactory.deploy(weth.address, wavax.address);

            await expect(
                aaveStrategy.connect(relayer).setUniswapRouter(uniswapRouter2.address)
            ).to.emit(aaveStrategy, "UniSwapRouterSet")
                .withArgs(uniswapRouter2.address, relayer.address);

            const address = await aaveStrategy.uniswapV2Router();
            expect(address).to.equal(uniswapRouter2.address);
        });
    });
});
