const {ethers, network} = require("hardhat");
const {expect} = require("chai");
const {expectRevert} = require("@openzeppelin/test-helpers");
const {getMock} = require("../../utils/mock_utils");

describe("Aave Lens unit test", function () {
    let accounts;
    let aaveLensFactory;
    let lendingPool, poolAddressProvider,
        aavePriceOracle, aaveDataProvider, aaveRewardsController;
    let relayer;
    let usdc, wavax, weth, aToken, rewardToken, debToken;

    before(async function () {
        accounts = await ethers.getSigners();
        relayer = accounts[0];

        aaveLensFactory = await ethers.getContractFactory("AaveLens");
        const tokenFactory = await ethers.getContractFactory("ERC20Mock");
        const debTokenFactory = await ethers.getContractFactory("DebtTokenMock");
        const aaveLendingPoolFactory = await ethers.getContractFactory("AavePoolMock");

        usdc = await tokenFactory.deploy("usdc");
        wavax = await tokenFactory.deploy("wavax");
        weth = await tokenFactory.deploy("weth");
        aToken = await tokenFactory.deploy("aToken");
        rewardToken = await tokenFactory.deploy("rewardToken");
        debToken = await debTokenFactory.deploy();
        lendingPool = await aaveLendingPoolFactory.deploy(aToken.address, rewardToken.address);

        aaveDataProvider = await getMock(relayer, "IPoolDataProvider");
        aaveRewardsController = await getMock(relayer, "IRewardsController");
        aavePriceOracle = await getMock(relayer, "IAaveOracle");

        poolAddressProvider = await getMock(relayer, "IPoolAddressesProvider");
        await poolAddressProvider.mock.getPool.returns(lendingPool.address);
    });

    describe("initialize", function () {
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

        it("should revert when poolAddressProvider address is zero", async function () {
            await expectRevert.unspecified(aaveLensFactory.deploy(
                ethers.constants.AddressZero,
                aaveRewardsController.address,
            ), "AAVE Lens: zero rewards address.");
        });

        it("should revert when rewardsController address is zero", async function () {
            await expectRevert(aaveLensFactory.deploy(
                poolAddressProvider.address,
                ethers.constants.AddressZero,
            ), "AAVE Lens: zero addresses provider address.");
        });

        it("constructor should success", async function () {
            expect(aaveLensFactory.deploy(
                poolAddressProvider.address,
                aaveRewardsController.address,
            )).not.to.be.reverted;
        });
    });

    describe("getters", function () {
        let snapshotId;

        before(async function () {
            this.aaveLens = await aaveLensFactory.deploy(
                poolAddressProvider.address,
                aaveRewardsController.address,
            );
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

        it("should get aaveProvider", async function () {
            const provider = await this.aaveLens.aaveProvider();
            expect(provider).to.equal(poolAddressProvider.address);
        });

        it("should get aavePool", async function () {
            const pool = await this.aaveLens.aavePool();
            expect(pool).to.equal(lendingPool.address);
        });

        it("should get rewardsController", async function () {
            const rewardController = await this.aaveLens.rewardsController();
            expect(rewardController).to.equal(aaveRewardsController.address);
        });
    });
});
