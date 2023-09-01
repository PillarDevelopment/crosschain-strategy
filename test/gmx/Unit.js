const { ethers, network, upgrades, waffle } = require("hardhat");
const { expect } = require("chai");
const { expectRevert } = require("@openzeppelin/test-helpers");
const { smock } = require("@defi-wonderland/smock");
const chai = require("chai");

chai.use(smock.matchers);

describe("GmxVault unit test", function () {
  const NATIVE_CHAIN_ID = 1;

  let accounts;
  let gmxBlockFactory;
  let relayer,
    dcRouter,
    glpManager,
    mintRouter,
    rewardRouter,
    gmxVault,
    glpToken,
    glpTrackerToken;
  let usdc, lzEndpoint;
  let forbiddenUser;

  before(async function () {
    accounts = await ethers.getSigners();
    relayer = accounts[0];
    lzEndpoint = accounts[1];
    forbiddenUser = accounts[2];
    dcRouter = accounts[3];

    const tokenFactory = await smock.mock("ERC20Mock");

    usdc = await tokenFactory.deploy("usdc");
    glpToken = await tokenFactory.deploy("GLP");
    glpTrackerToken = await tokenFactory.deploy("GLP TrackerToken");

    glpManager = await smock.fake("IGlpManager");
    mintRouter = await smock.fake("IRewardRouterV2");
    rewardRouter = await smock.fake("IRewardRouterV2");
    gmxVault = await smock.fake("contracts/integrations/gmx/IVault.sol:IVault");

    await glpManager.vault.returns(gmxVault.address);
    await mintRouter.glp.returns(glpToken.address);
    await mintRouter.stakedGlpTracker.returns(glpTrackerToken.address);

    gmxBlockFactory = await ethers.getContractFactory("GmxVault");
  });

  function getBlockInitParams({
    glpManagerAddress = ethers.constants.AddressZero,
    mintRouterAddress = ethers.constants.AddressZero,
    rewardRouterAddress = ethers.constants.AddressZero,
    relayerAddress = ethers.constants.AddressZero,
    nativeId = NATIVE_CHAIN_ID,
    usdcToken = ethers.constants.AddressZero,
    dcRouterAddress = ethers.constants.AddressZero,
  }) {
    return ethers.utils.defaultAbiCoder.encode(
      [
        "address",
        "address",
        "address",
        "address",
        "uint16",
        "address",
        "address",
      ],
      [
        glpManagerAddress,
        mintRouterAddress,
        rewardRouterAddress,
        relayerAddress,
        nativeId,
        usdcToken,
        dcRouterAddress,
      ]
    );
  }

  describe("initialize", function () {
    let snapshotId;
    let gmxBlock;

    before(async function () {
      gmxBlock = await gmxBlockFactory.deploy();
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

    it("should revert when glpManagerAddress address is zero", async function () {
      const initParams = getBlockInitParams({
        mintRouterAddress: mintRouter.address,
        rewardRouterAddress: rewardRouter.address,
        relayerAddress: relayer.address,
        usdcToken: usdc.address,
        dcRouterAddress: dcRouter.address,
      });
      await expectRevert(
        gmxBlock.initialize(initParams),
        "GMX Vault::initialize::zero glpManager address"
      );
    });

    it("should revert when mintRouter address is zero", async function () {
      const initParams = getBlockInitParams({
        glpManagerAddress: glpManager.address,
        rewardRouterAddress: rewardRouter.address,
        relayerAddress: relayer.address,
        usdcToken: usdc.address,
        dcRouterAddress: dcRouter.address,
      });
      await expectRevert(
        gmxBlock.initialize(initParams),
        "GMX Vault::initialize::zero mintRouter address"
      );
    });

    it("should revert when rewardRouter address is zero", async function () {
      const initParams = getBlockInitParams({
        glpManagerAddress: glpManager.address,
        mintRouterAddress: mintRouter.address,
        relayerAddress: relayer.address,
        usdcToken: usdc.address,
        dcRouterAddress: dcRouter.address,
      });
      await expectRevert(
        gmxBlock.initialize(initParams),
        "GMX Vault::initialize::zero rewardRouter address"
      );
    });

    it("should revert when relayer address is zero", async function () {
      const initParams = getBlockInitParams({
        glpManagerAddress: glpManager.address,
        mintRouterAddress: mintRouter.address,
        rewardRouterAddress: rewardRouter.address,
        usdcToken: usdc.address,
        dcRouterAddress: dcRouter.address,
      });
      await expectRevert(
        gmxBlock.initialize(initParams),
        "GMX Vault::initialize::zero relayer address"
      );
    });

    it("should revert when usdc address is zero", async function () {
      const initParams = getBlockInitParams({
        glpManagerAddress: glpManager.address,
        mintRouterAddress: mintRouter.address,
        rewardRouterAddress: rewardRouter.address,
        relayerAddress: relayer.address,
        nativeLZEndpoint: lzEndpoint.address,
        dcRouterAddress: dcRouter.address,
      });
      await expectRevert(
        gmxBlock.initialize(initParams),
        "GMX Vault::initialize::zero usdc address"
      );
    });

    it("should revert when nativeId less than 1", async function () {
      const initParams = getBlockInitParams({
        glpManagerAddress: glpManager.address,
        mintRouterAddress: mintRouter.address,
        rewardRouterAddress: rewardRouter.address,
        relayerAddress: relayer.address,
        usdcToken: usdc.address,
        nativeId: 0,
        dcRouterAddress: dcRouter.address,
      });
      await expectRevert(
        gmxBlock.initialize(initParams),
        "GMX Vault::initialize::zero native id"
      );
    });

    it("should revert when dcRouter address is zero", async function () {
      const initParams = getBlockInitParams({
        glpManagerAddress: glpManager.address,
        mintRouterAddress: mintRouter.address,
        rewardRouterAddress: rewardRouter.address,
        relayerAddress: relayer.address,
        usdcToken: usdc.address,
      });
      await expectRevert(
        gmxBlock.initialize(initParams),
        "GMX Vault::initialize::zero dcNativeRouter address"
      );
    });

    it("constructor should success", async function () {
      const initParams = getBlockInitParams({
        glpManagerAddress: glpManager.address,
        mintRouterAddress: mintRouter.address,
        rewardRouterAddress: rewardRouter.address,
        relayerAddress: relayer.address,
        usdcToken: usdc.address,
        dcRouterAddress: dcRouter.address,
      });
      await expect(gmxBlock.initialize(initParams)).not.to.be.reverted;
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
      const initParams = getBlockInitParams({
        glpManagerAddress: glpManager.address,
        mintRouterAddress: mintRouter.address,
        rewardRouterAddress: rewardRouter.address,
        relayerAddress: relayer.address,
        usdcToken: usdc.address,
        dcRouterAddress: dcRouter.address,
      });
      const gmxBlock = await gmxBlockFactory.deploy();
      await gmxBlock.initialize(initParams);
      await expect(gmxBlock.initialize(initParams)).to.be.reverted;
    });

    it("should forbid upgrade from not owner", async function () {
      const initParams = getBlockInitParams({
        glpManagerAddress: glpManager.address,
        mintRouterAddress: mintRouter.address,
        rewardRouterAddress: rewardRouter.address,
        relayerAddress: relayer.address,
        usdcToken: usdc.address,
        dcRouterAddress: dcRouter.address,
      });

      const gmxBlockUpgradeable = await upgrades.deployProxy(gmxBlockFactory, [
        initParams,
      ]);
      await gmxBlockUpgradeable.deployed();

      const gmxBlockNew = await gmxBlockFactory.deploy();

      await expect(
        gmxBlockUpgradeable
          .connect(forbiddenUser)
          .upgradeTo(gmxBlockNew.address)
      ).to.be.revertedWith("'Ownable: caller is not the owner");
    });

    it("should allow upgrade from owner", async function () {
      const initParams = getBlockInitParams({
        glpManagerAddress: glpManager.address,
        mintRouterAddress: mintRouter.address,
        rewardRouterAddress: rewardRouter.address,
        relayerAddress: relayer.address,
        usdcToken: usdc.address,
        dcRouterAddress: dcRouter.address,
      });

      const gmxBlockUpgradeable = await upgrades.deployProxy(gmxBlockFactory, [
        initParams,
      ]);
      await gmxBlockUpgradeable.deployed();

      const gmxBlockNew = await gmxBlockFactory.deploy();

      await expect(gmxBlockUpgradeable.upgradeTo(gmxBlockNew.address)).not.to.be
        .reverted;
    });
  });

  describe("getters", function () {
    let snapshotId;
    let gmxBlock;

    before(async function () {
      gmxBlock = await gmxBlockFactory.deploy();
      const initParams = getBlockInitParams({
        glpManagerAddress: glpManager.address,
        mintRouterAddress: mintRouter.address,
        rewardRouterAddress: rewardRouter.address,
        relayerAddress: relayer.address,
        usdcToken: usdc.address,
        dcRouterAddress: dcRouter.address,
      });
      await gmxBlock.initialize(initParams);
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

    it("should get gmxVault", async function () {
      const vault = await gmxBlock.gmxVault();
      expect(vault).to.equal(gmxVault.address);
    });

    it("should get mintRouter", async function () {
      const router = await gmxBlock.mintRouter();
      expect(router).to.equal(mintRouter.address);
    });

    it("should get rewardRouter", async function () {
      const router = await gmxBlock.rewardRouter();
      expect(router).to.equal(rewardRouter.address);
    });

    it("should get glpManager", async function () {
      const manager = await gmxBlock.glpManager();
      expect(manager).to.equal(glpManager.address);
    });

    it("should get glpToken", async function () {
      const token = await gmxBlock.glpToken();
      expect(token).to.equal(glpToken.address);
    });

    it("should get glpTrackerToken", async function () {
      const token = await gmxBlock.glpTrackerToken();
      expect(token).to.equal(glpTrackerToken.address);
    });

    it("should get nativeRouter", async function () {
      const nativeRouter = await gmxBlock.nativeRouter();
      expect(nativeRouter).to.equal(dcRouter.address);
    });
  });

  describe("auth modifiers", function () {
    let snapshotId;
    let gmxBlock;

    before(async function () {
      gmxBlock = await gmxBlockFactory.deploy();

      const initParams = getBlockInitParams({
        glpManagerAddress: glpManager.address,
        mintRouterAddress: mintRouter.address,
        rewardRouterAddress: rewardRouter.address,
        relayerAddress: relayer.address,
        usdcToken: usdc.address,
        dcRouterAddress: dcRouter.address,
      });
      await gmxBlock.initialize(initParams);
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

    it("should forbid buyGLP", async function () {
      const tx = gmxBlock
        .connect(forbiddenUser)
        .buyGLP(usdc.address, 100000, 0, 0);
      await expect(tx).to.be.revertedWith("BaseAppStorage:Only relayer");
    });

    it("should forbid sellGLP", async function () {
      const tx = gmxBlock
        .connect(forbiddenUser)
        .sellGLP(usdc.address, 100000, 0);
      await expect(tx).to.be.revertedWith("BaseAppStorage:Only relayer");
    });

    it("should forbid claimRewards", async function () {
      const tx = gmxBlock
        .connect(forbiddenUser)
        .claimRewards(false, false, false, false, false, false, false);
      await expect(tx).to.be.revertedWith("BaseAppStorage:Only relayer");
    });
  });

  describe("buy GLP", function () {
    let snapshotId;
    let gmxBlock;

    before(async function () {
      gmxBlock = await gmxBlockFactory.deploy();

      const initParams = getBlockInitParams({
        glpManagerAddress: glpManager.address,
        mintRouterAddress: mintRouter.address,
        rewardRouterAddress: rewardRouter.address,
        relayerAddress: relayer.address,
        usdcToken: usdc.address,
        dcRouterAddress: dcRouter.address,
      });
      await gmxBlock.initialize(initParams);
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

    it("should revert on zero amount", async function () {
      const tx = gmxBlock.connect(relayer).buyGLP(usdc.address, 0, 0, 0);
      await expect(tx).to.be.revertedWith("GMX Vault::buyGLP::zero amount");
    });

    it("should revert on native stake when low balance", async function () {
      const provider = waffle.provider;
      const blockBalance = await provider.getBalance(gmxBlock.address);
      const stakeAmount = 100000000;
      expect(blockBalance.toString()).to.be.equal("0");
      const tx = gmxBlock
        .connect(relayer)
        .buyGLP(ethers.constants.AddressZero, stakeAmount, 0, 0);
      await expect(tx).to.be.revertedWith(
        "GMX Vault::buyGLP::bridge or deposit native currency"
      );
    });

    it("should revert on stake when low token balance", async function () {
      const blockBalance = await usdc.balanceOf(gmxBlock.address);
      const stakeAmount = 100000000;
      expect(blockBalance.toString()).to.be.equal("0");
      const tx = gmxBlock
        .connect(relayer)
        .buyGLP(usdc.address, stakeAmount, 0, 0);
      await expect(tx).to.be.revertedWith(
        "GMX Vault::buyGLP::bridge or deposit assets"
      );
    });
  });
});
