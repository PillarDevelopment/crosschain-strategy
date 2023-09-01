const { ethers, network } = require("hardhat");
const { expect } = require("chai");
const { expectRevert } = require("@openzeppelin/test-helpers");

const NATIVE_CHAIN_ID = "1";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

describe("DcRouter unit test", function () {
  let accounts;
  let dcRouter;
  let usdcAddress, usdtAddress;
  let relayerAddress, bridgeAddress;
  let deployer;

  before(async function () {
    accounts = await ethers.getSigners();
    deployer = accounts[0];
    relayerAddress = accounts[1];
    bridgeAddress = accounts[2];
    usdcAddress = accounts[3];
    usdtAddress = accounts[4];

    const dcRouterFactory = await ethers.getContractFactory("DcRouter");
    dcRouter = await dcRouterFactory.deploy(
      relayerAddress.address,
      deployer.address,
      usdcAddress.address,
      NATIVE_CHAIN_ID
    );
    await dcRouter.connect(relayerAddress).setBridge(bridgeAddress.address);
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

    it("should successful initialize", async function () {
      const dcRouterFactory = await ethers.getContractFactory("DcRouter");
      const deployedRouterAddress = await dcRouterFactory.deploy(
        relayerAddress.address,
        deployer.address,
        usdcAddress.address,
        NATIVE_CHAIN_ID
      );
      expect(deployedRouterAddress.address.toString()).not.equal(ZERO_ADDRESS);
    });

    it("should revert with zero address", async function () {
      const dcRouterFactory = await ethers.getContractFactory("DcRouter");
      await expectRevert(
        dcRouterFactory.deploy(
          relayerAddress.address,
          ZERO_ADDRESS,
          usdcAddress.address,
          NATIVE_CHAIN_ID
        ),
        "DcRouter::constructor:treasures is zero address"
      );
      await expectRevert(
        dcRouterFactory.deploy(
          ZERO_ADDRESS,
          deployer.address,
          usdcAddress.address,
          NATIVE_CHAIN_ID
        ),
        "DcRouter::constructor: relayer is zero address"
      );
      await expectRevert(
        dcRouterFactory.deploy(
          relayerAddress.address,
          deployer.address,
          ZERO_ADDRESS,
          NATIVE_CHAIN_ID
        ),
        "DcRouter::constructor:usdc is zero address"
      );
      await expectRevert(
        dcRouterFactory.deploy(
          relayerAddress.address,
          deployer.address,
          usdcAddress.address,
          0
        ),
        "DcRouter::constructor:nativeId is zero"
      );
    });
  });

  describe("Initial Params", function () {
    it("should get params", async function () {
      const nativeBridge = await dcRouter.sgBridge();
      const currentStable = await dcRouter.currentUSDCToken();
      const treasurer = await dcRouter.deCommasTreasurer();
      const nativeChain = await dcRouter.nativeChainId();
      expect(nativeBridge.toString()).to.equal(bridgeAddress.address);
      expect(currentStable.toString()).to.equal(usdcAddress.address);
      expect(treasurer.toString()).to.equal(deployer.address);
      expect(nativeChain.toString()).to.equal(NATIVE_CHAIN_ID);
    });
  });

  describe("Setters", function () {
    it("should set bridge", async function () {
      await dcRouter.connect(relayerAddress).setBridge(bridgeAddress.address);
      const nativeBridge = await dcRouter.sgBridge();
      expect(nativeBridge.toString()).to.equal(bridgeAddress.address);
    });

    it("should set stable", async function () {
      const tokenBefore = await dcRouter.currentUSDCToken();
      expect(tokenBefore.toString()).to.equal(usdcAddress.address);
      await dcRouter.connect(relayerAddress).setStable(usdtAddress.address);
      const tokenAfter = await dcRouter.currentUSDCToken();
      expect(tokenAfter.toString()).to.equal(usdtAddress.address);
    });
  });

  describe("Exceptions", function () {
    it("should revert setters with only self call", async function () {
      await expectRevert(
        dcRouter.connect(deployer).setStable(usdtAddress.address),
        "BaseAppStorage:Only relayer"
      );
      await expectRevert(
        dcRouter.connect(deployer).setBridge(bridgeAddress.address),
        "BaseAppStorage:Only relayer"
      );
      await expectRevert(
        dcRouter
          .connect(deployer)
          .bridge(
            usdcAddress.address,
            0,
            NATIVE_CHAIN_ID,
            deployer.address,
            usdtAddress.address,
            { value: 0 }
          ),
        "BaseAppStorage:Only relayer"
      );
      await expectRevert(
        dcRouter
          .connect(deployer)
          .transferDeposits(
            [NATIVE_CHAIN_ID],
            [usdcAddress.address],
            [100000],
            [usdcAddress.address],
            NATIVE_CHAIN_ID,
            0,
            { value: 1 }
          ),
        "BaseAppStorage:Only relayer"
      );
      await expectRevert(
        dcRouter.connect(deployer).approveWithdraw(1, 666, 0),
        "BaseAppStorage:Only relayer"
      );
      await expectRevert(
        dcRouter.connect(deployer).cancelWithdraw(0, 666),
        "BaseAppStorage:Only relayer"
      );
    });
  });
});
