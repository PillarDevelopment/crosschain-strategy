const { ether} = require("@openzeppelin/test-helpers");
const {deployMockContract} = require('@ethereum-waffle/mock-contract');
const { ethers, contract, network} = require("hardhat");
const { expect } = require("chai");
const chai = require('chai')
const { smock } = require('@defi-wonderland/smock');

chai.use(smock.matchers);

const AavePriceOracle = require('../../../artifacts/contracts/integrations/aave/v3/IAaveOracle.sol/IAaveOracle.json');
const PoolDataProvider = require('../../../artifacts/contracts/integrations/aave/v3/IPoolDataProvider.sol/IPoolDataProvider.json');
const PoolAddressesProvider = require('../../../artifacts/contracts/integrations/aave/v3/IPoolAddressesProvider.sol/IPoolAddressesProvider.json');

contract("AAVE Vault integration test", function() {
  let accounts, signer1;
  let lendingPool, poolAddressProvider, wethGateway, dcRouter,
      aavePriceOracle, aaveDataProvider, aaveRewardsController, aaveStrategy;
  let relayer, aaveVault;
  let usdc, weth, aToken, rewardToken, debToken;

  before(async function () {
      accounts = await ethers.getSigners();
      relayer = accounts[0];
      signer1 = accounts[2];
      dcRouter = accounts[3];

      const aaveVaultFactory = await ethers.getContractFactory("AaveVault");
      const tokenFactory = await smock.mock('ERC20Mock');
      const strategyFactory = await ethers.getContractFactory("AaveStrategy");

      usdc = await tokenFactory.deploy("usdc");
      weth = await tokenFactory.deploy("weth");

      aToken = await tokenFactory.deploy("aToken");
      rewardToken = await tokenFactory.deploy("rewardToken");
      debToken = await smock.fake('DebtTokenMock');
      const lendingPoolFactory = await smock.mock('AavePoolMock');
      lendingPool = await lendingPoolFactory.deploy(aToken.address, rewardToken.address);

      aaveRewardsController = await smock.fake('IRewardsController');

      aavePriceOracle = await deployMockContract(relayer, AavePriceOracle.abi);
      aaveDataProvider = await deployMockContract(relayer, PoolDataProvider.abi);

      poolAddressProvider = await deployMockContract(relayer, PoolAddressesProvider.abi);
      await poolAddressProvider.mock.getPool.returns(lendingPool.address);
      await poolAddressProvider.mock.getPriceOracle.returns(aavePriceOracle.address);
      await poolAddressProvider.mock.getPoolDataProvider.returns(aaveDataProvider.address);

      wethGateway = await smock.fake('IWETHGateway');
      aaveStrategy = await strategyFactory.deploy();

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
            wethGateway.address,
            aaveRewardsController.address,
            relayer.address,
            usdc.address,
            aaveStrategy.address,
            debToken.address,
            1,
            dcRouter.address,
          ]
      );
      await aaveVault.initialize(initParams);

    });

    describe("Test set userEmode", function () {
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

        it("should set userEMode for AAVE lending pool", async function () {
            const eMode = 2;

            await expect(
                aaveVault.connect(relayer).setUserEMode(eMode)
            )
                .to.emit(aaveVault, "SetUserEMode")
                .withArgs(eMode);

            expect(lendingPool.setUserEMode).to.have.been.calledWith(
                eMode
            );
        });
    });

    describe("Test setCollateralAsset", function () {
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

        it("should setUserUseReserveAsCollateral usdc", async function () {
            await expect(
                aaveVault.connect(relayer).setCollateralAsset(usdc.address)
            )
                .to.emit(aaveVault, "SetCollateralEvent")
                .withArgs(usdc.address);

            expect(lendingPool.setUserUseReserveAsCollateral).to.have.been.calledWith(
                usdc.address, true
            );
        });

        it("should setUserUseReserveAsCollateral native", async function () {
            await wethGateway.getWETHAddress.returns(weth.address);
            await expect(
                aaveVault.connect(relayer).setCollateralAsset(ethers.constants.AddressZero)
            )
                .to.emit(aaveVault, "SetCollateralEvent")
                .withArgs(weth.address);

            expect(lendingPool.setUserUseReserveAsCollateral).to.have.been.calledWith(
                weth.address, true
            );
        });
    });

    describe("Test open position", function () {
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

        it("should open position on usdc", async function () {
            await usdc.mint(aaveVault.address, ether("1").toString());

            await expect(
                aaveVault.connect(relayer).openPosition( usdc.address,
                    ether("1").toString(),
                    0)
            )
                .to.emit(aaveVault, "OpenPositionEvent")
                .withArgs(usdc.address, ether("1").toString());

            expect(lendingPool.supply).to.have.been.calledWith(
                usdc.address, ether("1").toString(), aaveVault.address, 0
            );
        });

        it("should open position on native asset", async function () {
            await relayer.sendTransaction({
                to: aaveVault.address,
                value: ether("1").toString(),
            });
            await expect(
                aaveVault.connect(relayer).openPosition( ethers.constants.AddressZero,
                    ether("1").toString(),
                    0,)
            )
                .to.emit(aaveVault, "OpenPositionEvent")
                .withArgs(ethers.constants.AddressZero, ether("1").toString());

            expect(wethGateway.depositETH).to.have.been.calledWith(
                lendingPool.address, aaveVault.address, 0
            );
            expect(wethGateway.depositETH.getCall(0).value).to.eq(ether("1").toString());
        });

        it("should fail on low balance usdc", async function () {
            await usdc.mint(aaveVault.address, ether("1").toString());

            await expect(
                aaveVault.connect(relayer).openPosition( usdc.address,
                    ether("2").toString(),
                    0,)
            ).to.be.revertedWith("AaveVault::openPosition: amount greater than baseAsset balance");
        });

        it("should fail on low native balance", async function () {
            await expect(
                aaveVault.connect(relayer).openPosition(  ethers.constants.AddressZero,
                    ether("2").toString(),
                    0,)
            ).to.be.revertedWith("AaveVault::openPosition: amount greater than native balance");
        });
    });

    describe("Test borrow", function () {
        let snapshotId;

        beforeEach(async function () {
            snapshotId = await network.provider.request({
                method: "evm_snapshot",
                params: [],
            });

            await usdc.mint(aaveVault.address, ether("1").toString());
            await weth.mint(lendingPool.address, ether("10").toString());

            await aaveVault.connect(relayer).openPosition( usdc.address,
                ether("1").toString(),
                0,);
        });

        afterEach(async function () {
            await network.provider.request({
                method: "evm_revert",
                params: [snapshotId],
            });
        });

        it("should borrow weth", async function () {
            await expect(
                aaveVault.connect(relayer).borrow(  weth.address,
                    ether("1").toString(),
                    2,
                    0,)
            )
                .to.emit(aaveVault, "BorrowEvent")
                .withArgs(weth.address, ether("1").toString());

            expect(lendingPool.borrow).to.have.been.calledWith(
                weth.address, ether("1").toString(), 2, 0, aaveVault.address
            );
        });

        it("should borrow native", async function () {

            await expect(
                aaveVault.connect(relayer).borrow(  ethers.constants.AddressZero,
                    ether("1").toString(),
                    2,
                    0,)
            )
                .to.emit(aaveVault, "BorrowEvent")
                .withArgs(ethers.constants.AddressZero, ether("1").toString());

            expect(debToken.approveDelegation).to.have.been.calledWith(
                wethGateway.address, ether("1").toString(),
            );
            expect(wethGateway.borrowETH).to.have.been.calledWith(
                lendingPool.address, ether("1").toString(), 2, 0,
            );
        });
    });

    describe("Test repay", function () {
        let snapshotId;

        beforeEach(async function () {
            snapshotId = await network.provider.request({
                method: "evm_snapshot",
                params: [],
            });

            await usdc.mint(aaveVault.address, ether("1").toString());
            await weth.connect(signer1).mint(aaveVault.address, ether("10").toString());
        });

        afterEach(async function () {
            await network.provider.request({
                method: "evm_revert",
                params: [snapshotId],
            });
        });

        it("should repay weth", async function () {
            await expect(
                aaveVault.connect(relayer).repay(  weth.address,
                    ether("1").toString(),
                    2,)
            )
                .to.emit(aaveVault, "RepayEvent")
                .withArgs(weth.address, ether("1").toString());

            expect(weth.approve).to.have.been.calledWith(
                lendingPool.address, ether("1").toString()
            );
            expect(lendingPool.repay).to.have.been.calledWith(
                weth.address, ether("1").toString(), 2, aaveVault.address
            );
        });

        it("should repay native", async function () {
            await relayer.sendTransaction({
                to: aaveVault.address,
                value: ether("1").toString(),
            });

            await expect(
                aaveVault.connect(relayer).repay( ethers.constants.AddressZero,
                    ether("1").toString(),
                    2,)
            )
                .to.emit(aaveVault, "RepayEvent")
                .withArgs(ethers.constants.AddressZero, ether("1").toString());

            expect(wethGateway.repayETH).to.have.been.calledWith(
                lendingPool.address, ether("1").toString(), 2, aaveVault.address
            );
        });
    });

    describe("Test close position", function () {
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

        it("should close position in usdc", async function () {
            // await usdc.mint(aaveVault.address, ether("1").toString());
            // await usdc.mint(lendingPool.address, ether("1").toString());
            await usdc.mint(aaveVault.address, ether("1").toString());

            aaveVault.connect(relayer).openPosition(  usdc.address,
                ether("1").toString(),
                0,);
            await expect(
                aaveVault.connect(relayer).closePosition( usdc.address,
                    ether("1").toString(),)
            )
                .to.emit(aaveVault, "ClosePositionEvent")
                .withArgs(usdc.address, ether("1").toString());

            expect(lendingPool.withdraw).to.have.been.calledWith(
                usdc.address, ether("1").toString(), aaveVault.address
            );
        });

        it("should close position in native", async function () {
            await relayer.sendTransaction({
                to: aaveVault.address,
                value: ether("1").toString(),
            });
            await expect(
                aaveVault.connect(relayer).closePosition( ethers.constants.AddressZero,
                    ether("1").toString(),)
            )
                .to.emit(aaveVault, "ClosePositionEvent")
                .withArgs(ethers.constants.AddressZero, ether("1").toString());

            expect(wethGateway.withdrawETH).to.have.been.calledWith(
                lendingPool.address, ether("1").toString(), aaveVault.address
            );
        });
    });


    describe("Test claim all rewards", function () {
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

        it("should call claim all rewards", async function () {
            await expect(
                aaveVault.connect(relayer).claimAllRewards( [usdc.address, ethers.constants.AddressZero],
                    signer1.address,)
            )
                .to.emit(aaveVault, "ClaimedRewardsEvent")
                .withArgs([usdc.address, ethers.constants.AddressZero], signer1.address);

            expect(aaveRewardsController.claimAllRewards).to.have.been.calledWith(
                [usdc.address, ethers.constants.AddressZero], signer1.address
            );
        });
    });
});
