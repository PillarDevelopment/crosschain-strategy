const { ethers, network } = require("hardhat");
const { expect } = require("chai");
const { expectRevert } = require("@openzeppelin/test-helpers");

describe("PerpetualVault integration test", function () {
  let accounts;
  let perpVault;
  let relayer,
    dcRouter,
    perpPortal,
    clearingHouse,
    usdc,
    weth,
    veth,
    iVaultPerp,
    wallet;
  const NATIVE_CHAIN_ID = "1";
  const POSITION_AMOUNT = "100000000";
  let toWei;
  let ETHER1;

  before(async function () {
    accounts = await ethers.getSigners();
    relayer = accounts[0];
    wallet = accounts[1];
    dcRouter = accounts[2];

    toWei = ethers.utils.parseEther;
    ETHER1 = toWei("1");

    const perpProtocolUserVaultFactory = await ethers.getContractFactory(
      "PerpetualVaultMock"
    );
    const clearingHouseFactory = await ethers.getContractFactory(
      "ClearingHouseMock"
    );
    const portalFactory = await ethers.getContractFactory("PerpPortalMock");
    const tokenFactory = await ethers.getContractFactory("ERC20Mock");
    const perpVaultFactory = await ethers.getContractFactory("PerpetualVault");
    const vPerpTokenMockFactory = await ethers.getContractFactory(
      "vPerpTokenMock"
    );

    usdc = await tokenFactory.deploy("USDC");
    weth = await tokenFactory.deploy("wETH");
    veth = await vPerpTokenMockFactory.deploy("vETH");
    clearingHouse = await clearingHouseFactory.deploy();
    iVaultPerp = await perpProtocolUserVaultFactory.deploy(veth.address);
    perpPortal = await portalFactory.deploy(
      iVaultPerp.address,
      clearingHouse.address
    );

    const initParams = ethers.utils.defaultAbiCoder.encode(
      [
        "address",
        "address",
        "address",
        "address",
        "address",
        "uint16",
        "uint160",
        "address",
      ],
      [
        relayer.address,
        perpPortal.address,
        usdc.address,
        weth.address,
        veth.address,
        NATIVE_CHAIN_ID,
        300,
        dcRouter.address,
      ]
    );
    perpVault = await perpVaultFactory.deploy();
    await perpVault.initialize(initParams);
  });

  describe("Getters", function () {
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

    it("should return account value", async function () {
      const accountValue = await perpVault.getAccountValue();
      expect(accountValue.toString()).to.be.equal(ETHER1);
    });

    it("should return free collateral", async function () {
      const freeCollateral = await perpVault.getFreeCollateral();
      expect(freeCollateral.toString()).to.be.equal(ETHER1);
      expect(freeCollateral.toString()).to.be.equal(
        await perpPortal.getFreeCollateral(perpVault.address)
      );
    });

    it("should return native strategy token price", async function () {
      const basicTokenPrice = await perpVault.getNativeStrategyTokenPrice();
      expect(basicTokenPrice).to.be.equal("1500000000");
    });

    it("should return total Abs Position Value", async function () {
      const absPosition = await perpVault.getTotalAbsPositionValue();
      expect(absPosition.toString()).to.be.equal(ETHER1);
      expect(absPosition).to.be.equal(
        await perpPortal.getTotalAbsPositionValue(perpVault.address)
      );
    });

    it("should return current Funding Rate", async function () {
      const fundingRate = await perpVault.getCurrentFundingRate();
      expect(fundingRate.toString()).to.be.equal("0");
    });

    it("should return liquidate price", async function () {
      const vaultLiquidatePrice = await perpVault.getLiquidatePrice();
      expect(vaultLiquidatePrice.toString()).to.be.equal(ETHER1);
      expect(vaultLiquidatePrice).to.be.equal(
        await perpPortal.getLiquidationPrice(perpVault.address, veth.address)
      );
    });

    it("should return total USDC value", async function () {
      const vaultUSDCValue = await perpVault.getTotalUSDCValue();
      expect(vaultUSDCValue.toString()).to.be.equal("1000000");
    });
  });

  describe("directDepositToVault", function () {
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
    it("should direct deposit to vault", async function () {
      await usdc.mint(perpVault.address, POSITION_AMOUNT);

      await expect(
        perpVault.connect(relayer).directDepositToVault(POSITION_AMOUNT)
      )
        .to.emit(perpVault, "USDCDeposited")
        .withArgs(POSITION_AMOUNT);
      const houseUsdcBalance = await usdc.balanceOf(perpVault.address);
      expect(houseUsdcBalance.toString()).not.equal(POSITION_AMOUNT);
    });
    it("should revert directDepositToVault with only self", async function () {
      await expectRevert(
        perpVault.connect(wallet).directDepositToVault(relayer.address),
        "BaseAppStorage:Only relayer"
      );
    });
    it("should revert directDepositToVault with zero amount", async function () {
      await expectRevert(
        perpVault.connect(relayer).directDepositToVault("0"),
        "PerpetualVault::directDepositToVault: zero amount"
      );
    });
  });

  describe("openPosition", function () {
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
    it("should open long position", async function () {
      await usdc.mint(perpVault.address, POSITION_AMOUNT);

      let housePosition = await clearingHouse.positions();
      expect(housePosition.toString()).be.equal("0");
      await expect(perpVault.connect(relayer).openPosition(POSITION_AMOUNT))
        .to.emit(perpVault, "USDCDeposited")
        .withArgs(POSITION_AMOUNT)
        .to.emit(perpVault, "OpenPosition")
        .withArgs(veth.address, true, POSITION_AMOUNT)
        .to.emit(perpVault, "PositionAdjusted")
        .withArgs(true, true, POSITION_AMOUNT);
      housePosition = await clearingHouse.positions();
      expect(housePosition.toString()).be.equal(POSITION_AMOUNT);
    });
    it("should open position with amount more than free collateral", async function () {
      const SHORT_SIZE = "-100000000";
      await usdc.mint(perpVault.address, POSITION_AMOUNT);

      await perpPortal.modifyFreeCollateral("0");
      await expect(perpVault.connect(relayer).openPosition(SHORT_SIZE))
        .to.emit(perpVault, "OpenPosition")
        .withArgs(veth.address, false, SHORT_SIZE)
        .to.emit(perpVault, "Withdrawal")
        .withArgs(veth.address, POSITION_AMOUNT)
        .to.emit(perpVault, "PositionAdjusted")
        .withArgs(true, false, POSITION_AMOUNT);
    });
    it("should open short position", async function () {
      await usdc.mint(perpVault.address, POSITION_AMOUNT);
      const SHORT_SIZE = "-100000000";

      let housePosition = await clearingHouse.positions();
      expect(housePosition.toString()).be.equal("0");
      await expect(perpVault.connect(relayer).openPosition(SHORT_SIZE))
        .to.emit(perpVault, "OpenPosition")
        .withArgs(veth.address, false, SHORT_SIZE)
        .to.emit(perpVault, "Withdrawal")
        .withArgs(veth.address, POSITION_AMOUNT)
        .to.emit(perpVault, "PositionAdjusted")
        .withArgs(true, false, POSITION_AMOUNT);
      housePosition = await clearingHouse.positions();
      expect(housePosition.toString()).be.equal(POSITION_AMOUNT);
    });
    it("should revert openPosition with only self", async function () {
      await expectRevert(
        perpVault.connect(wallet).openPosition(relayer.address),
        "BaseAppStorage:Only relayer"
      );
    });
  });

  describe("closePosition", function () {
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
    it("should close position", async function () {
      await usdc.mint(perpVault.address, POSITION_AMOUNT);
      let housePosition = await clearingHouse.positions();
      expect(housePosition.toString()).be.equal("0");
      await expect(perpVault.connect(relayer).openPosition(POSITION_AMOUNT))
        .to.emit(perpVault, "USDCDeposited")
        .withArgs(POSITION_AMOUNT)
        .to.emit(perpVault, "OpenPosition")
        .withArgs(veth.address, true, POSITION_AMOUNT)
        .to.emit(perpVault, "PositionAdjusted")
        .withArgs(true, true, POSITION_AMOUNT);
      housePosition = await clearingHouse.positions();
      expect(housePosition.toString()).be.equal(POSITION_AMOUNT);
      await expect(perpVault.connect(relayer).closePosition(POSITION_AMOUNT))
        .to.emit(perpVault, "ClosePosition")
        .withArgs(veth.address, POSITION_AMOUNT)
        .to.emit(perpVault, "Withdrawal")
        .withArgs(veth.address, POSITION_AMOUNT)
        .to.emit(perpVault, "EmergencyClosed")
        .withArgs(relayer.address, "1000000000000000000");
      housePosition = await clearingHouse.positions();
      expect(housePosition.toString()).be.equal("0");
    });
    it("should revert closePosition with only self", async function () {
      await expectRevert(
        perpVault.connect(wallet).closePosition("0"),
        "BaseAppStorage:Only relayer"
      );
    });
  });
});
