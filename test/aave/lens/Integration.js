const { constants, ether} = require("@openzeppelin/test-helpers");
const { BigNumber } = require("ethers");
const { ethers, network} = require("hardhat");
const { expect } = require("chai");
const {getMock} = require("../../utils/mock_utils");

describe("AAVE Lens integration test", function() {
  let accounts, signer1, signer2;
  let aaveLensFactory;
  let lendingPool, poolAddressProvider,
      aavePriceOracle, aaveDataProvider, aaveRewardsController;
  let relayer, aaveLens;
  let usdc, wavax, weth, aToken, rewardToken, debToken;

  before(async function () {
      accounts = await ethers.getSigners();
      relayer = accounts[0];
      signer1 = accounts[1];
      signer2 = accounts[2];

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
      await poolAddressProvider.mock.getPriceOracle.returns(aavePriceOracle.address);
      await poolAddressProvider.mock.getPoolDataProvider.returns(aaveDataProvider.address);
    });

    describe("Test getters ", function () {
        let snapshotId;

        before(async function () {
            aaveLens = await aaveLensFactory.deploy(
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

        it("should get user all user rewards", async function () {
            await aaveRewardsController.mock.getAllUserRewards
                .withArgs([wavax.address], signer1.address)
                .returns(
                    [wavax.address],
                    [0]
            );
            await aaveRewardsController.mock.getAllUserRewards
                .withArgs([wavax.address, usdc.address, weth.address], signer2.address)
                .returns(
                    [wavax.address, usdc.address, weth.address],
                    [1, 2, 0]
            );
            const rewardsInitial = await aaveLens.getAllUserRewards([wavax.address], signer1.address);
            expect(rewardsInitial[0].toString()).to.equal(([wavax.address]).toString());
            expect(rewardsInitial[1].toString()).to.equal(([new BigNumber.from("0")]).toString());

            const rewards = await aaveLens.getAllUserRewards([wavax.address, usdc.address, weth.address], signer2.address);
            expect(rewards[0].toString()).to.equal(([wavax.address, usdc.address, weth.address]).toString());
            expect(rewards[1].toString()).to.equal(
              ([new BigNumber.from("1"), new BigNumber.from("2"), new BigNumber.from("0")]).toString()
            );
        });

        it("should get user eMode", async function () {
            const EMODE_DEFAULT = "0";
            const EMODE_ONE = "1";

            const emodeInitial = await aaveLens.getUserEMode(signer1.address);
            expect(emodeInitial.toString()).to.equal(EMODE_DEFAULT);

            await lendingPool.connect(signer1).setUserEMode(EMODE_ONE);

            const emode1 = await aaveLens.getUserEMode(signer1.address);
            expect(emode1.toString()).to.equal(EMODE_ONE);
            const emode2 = await aaveLens.getUserEMode(signer2.address);
            expect(emode2.toString()).to.equal(EMODE_DEFAULT);
        });

        it("should get user configuration", async function () {
            const DEFAULT_CONFIG = "0";
            const TEST_CONFIG = "1";

            const initialConfig = await aaveLens.getUserConfiguration(signer1.address);
            expect(initialConfig.toString()).to.equal(DEFAULT_CONFIG);

            await lendingPool.setUserConfiguration(signer1.address, TEST_CONFIG);

            const config1 = await aaveLens.getUserConfiguration(signer1.address);
            expect(config1.toString()).to.equal(TEST_CONFIG);
            const config2 = await aaveLens.getUserConfiguration(signer2.address);
            expect(config2.toString()).to.equal(DEFAULT_CONFIG);
        });

        it("should get reserves list", async function () {
            const initial = await aaveLens.getReservesList();
            expect(initial.toString()).to.equal("");

            await lendingPool.setReserveAsset(wavax.address);

            const reserves = await aaveLens.getReservesList();
            expect(reserves.toString()).to.equal(([wavax.address]).toString());
        });

        it("should get user account data", async function () {
            const DEFAULT_USER_ACCOUNT_DATA = [
                ether("1").toString(),//totalCollateralBase
                ether("1").toString(),//totalDebtBase
                ether("1").toString(),//availableBorrowsBase
                ether("1").toString(),//currentLiquidationThreshold
                ether("1").toString(),//ltv
                ether("1").toString(),//healthFactor
            ]
            const userAccountData = await aaveLens.getUserAccountData(signer1.address);
            expect(userAccountData.toString()).to.equal(DEFAULT_USER_ACCOUNT_DATA.toString());
        });

        it("should get position sizes", async function () {
            await aaveDataProvider.mock.getUserReserveData
                .returns(ether("1").toString(), "2", ether("3").toString(), "4", "5", "6", "7", "8", true);
            await aaveDataProvider.mock.getUserReserveData
                .withArgs(ethers.constants.AddressZero, signer1.address)
                .returns("0", "0", "0", "0", "0", "0", "0", "0", false);

            const positionSize0 = await aaveLens.getPositionSizes(signer1.address, [constants.ZERO_ADDRESS]);
            expect(positionSize0.toString()).to.equal("0");

            const positionSizes = await aaveLens.getPositionSizes(signer1.address, [wavax.address, usdc.address]);
            expect(positionSizes.toString()).to.equal("3000000000000000000,3000000000000000000");
        });

        it("should get position sizes in USDC", async function () {
            const variableDebt = BigNumber.from(ether("3").toString());
            const wavaxPrice = BigNumber.from("2");
            const usdcPrice = BigNumber.from("1");
            const decimal18 = BigNumber.from(ether("1").toString());

            await aaveDataProvider.mock.getUserReserveData
                .returns(ether("2").toString(), "2", variableDebt.toString(), "4", "5", "6", "7", "8", true);
            await aaveDataProvider.mock.getUserReserveData
                .withArgs(ethers.constants.AddressZero, signer1.address)
                .returns("0", "0", "0", "0", "0", "0", "0", "0", false);

            await aavePriceOracle.mock.getAssetsPrices.returns(["0", "0"]);
            const positionSizes0 = await aaveLens.getPositionSizesInUSDC(signer1.address, [wavax.address, usdc.address]);
            expect(positionSizes0.toString()).to.equal("0,0");

            await aavePriceOracle.mock.getAssetsPrices.returns([wavaxPrice, usdcPrice]);
            const positionSizes = await aaveLens.getPositionSizesInUSDC(signer1.address, [wavax.address, usdc.address]);
            expect(positionSizes).to.deep.equal([
                wavaxPrice.mul(variableDebt).div(decimal18),
                usdcPrice.mul(variableDebt).div(decimal18)
            ]);
        });
  });
});
