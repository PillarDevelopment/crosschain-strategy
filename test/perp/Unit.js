const { ethers, network } = require("hardhat");
const { expect } = require("chai");
const { expectRevert } = require("@openzeppelin/test-helpers");

describe("PerpetualVault unit test", function () {
  let accounts;
  let perpVault;
  let relayer,
    dcRouter,
    perpPortal,
    clearingHouse,
    usdc,
    weth,
    veth,
    iVaultPerp;
  const NATIVE_CHAIN_ID = "1";
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  before(async function () {
    accounts = await ethers.getSigners();
    relayer = accounts[0];
    iVaultPerp = accounts[1];
    clearingHouse = accounts[2];
    dcRouter = accounts[3];

    const portalFactory = await ethers.getContractFactory("PerpPortalMock");
    const tokenFactory = await ethers.getContractFactory("ERC20Mock");
    const perpVaultFactory = await ethers.getContractFactory("PerpetualVault");

    perpPortal = await portalFactory.deploy(
      iVaultPerp.address,
      clearingHouse.address
    );
    usdc = await tokenFactory.deploy("USDC");
    weth = await tokenFactory.deploy("wETH");
    veth = await tokenFactory.deploy("vETH");
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

  describe("Initialize", function () {
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
      const initParams = ethers.utils.defaultAbiCoder.encode(
        [
          "address",
          "address",
          "address",
          "address",
          "address",
          "uint16",
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
          NATIVE_CHAIN_ID,
          300,
          dcRouter.address,
        ]
      );
      const vaultFactory = await ethers.getContractFactory("PerpetualVault");
      const successVault = await vaultFactory.deploy();
      await successVault.initialize(initParams);
    });
    it("should revert initialize with relayer zero address", async function () {
      const perpVaultFactory = await ethers.getContractFactory(
        "PerpetualVault"
      );
      const perpVault2 = await perpVaultFactory.deploy();
      const zeroAddressParam = ethers.utils.defaultAbiCoder.encode(
        [
          "address",
          "address",
          "address",
          "address",
          "address",
          "uint16",
          "uint16",
          "uint160",
          "address",
        ],
        [
          ZERO_ADDRESS,
          perpPortal.address,
          usdc.address,
          weth.address,
          veth.address,
          NATIVE_CHAIN_ID,
          NATIVE_CHAIN_ID,
          300,
          dcRouter.address,
        ]
      );
      await expectRevert(
        perpVault2.initialize(zeroAddressParam),
        "PerpetualVault::initialize: relayer zero address"
      );
    });
    it("should revert initialize with optimismPerpPortal zero address", async function () {
      const perpVaultFactory = await ethers.getContractFactory(
        "PerpetualVault"
      );
      const perpVault2 = await perpVaultFactory.deploy();
      const zeroAddressParam = ethers.utils.defaultAbiCoder.encode(
        [
          "address",
          "address",
          "address",
          "address",
          "address",
          "uint16",
          "uint16",
          "uint160",
          "address",
        ],
        [
          relayer.address,
          ZERO_ADDRESS,
          usdc.address,
          weth.address,
          veth.address,
          NATIVE_CHAIN_ID,
          NATIVE_CHAIN_ID,
          300,
          dcRouter.address,
        ]
      );
      await expectRevert(
        perpVault2.initialize(zeroAddressParam),
        "PerpetualVault::initialize: optimismPerpPortal zero address"
      );
    });
    it("should revert initialize with usdcTokenAddress zero address", async function () {
      const perpVaultFactory = await ethers.getContractFactory(
        "PerpetualVault"
      );
      const perpVault2 = await perpVaultFactory.deploy();
      const zeroAddressParam = ethers.utils.defaultAbiCoder.encode(
        [
          "address",
          "address",
          "address",
          "address",
          "address",
          "uint16",
          "uint16",
          "uint160",
          "address",
        ],
        [
          relayer.address,
          perpPortal.address,
          ZERO_ADDRESS,
          weth.address,
          veth.address,
          NATIVE_CHAIN_ID,
          NATIVE_CHAIN_ID,
          300,
          dcRouter.address,
        ]
      );
      await expectRevert(
        perpVault2.initialize(zeroAddressParam),
        "PerpetualVault::initialize: usdcTokenAddress zero address"
      );
    });
    it("should revert initialize with wTokenAddress zero address", async function () {
      const perpVaultFactory = await ethers.getContractFactory(
        "PerpetualVault"
      );
      const perpVault2 = await perpVaultFactory.deploy();
      const zeroAddressParam = ethers.utils.defaultAbiCoder.encode(
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
          ZERO_ADDRESS,
          veth.address,
          NATIVE_CHAIN_ID,
          300,
          dcRouter.address,
        ]
      );
      await expectRevert(
        perpVault2.initialize(zeroAddressParam),
        "PerpetualVault::initialize: wTokenAddress zero address"
      );
    });
    it("should revert initialize with baseToken zero address", async function () {
      const perpVaultFactory = await ethers.getContractFactory(
        "PerpetualVault"
      );
      const perpVault2 = await perpVaultFactory.deploy();
      const zeroAddressParam = ethers.utils.defaultAbiCoder.encode(
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
          ZERO_ADDRESS,
          NATIVE_CHAIN_ID,
          300,
          dcRouter.address,
        ]
      );
      await expectRevert(
        perpVault2.initialize(zeroAddressParam),
        "PerpetualVault::initialize: baseToken zero address"
      );
    });
    it("should revert initialize with relayer zero id", async function () {
      const perpVaultFactory = await ethers.getContractFactory(
        "PerpetualVault"
      );
      const perpVault2 = await perpVaultFactory.deploy();
      const zeroAddressParam = ethers.utils.defaultAbiCoder.encode(
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
          0,
          300,
          dcRouter.address,
        ]
      );
      await expectRevert(
        perpVault2.initialize(zeroAddressParam),
        "PerpetualVault::initialize: nativeId zero id"
      );
    });
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
    it("should return wrapped native chain stable address", async function () {
      const currentWeth = await perpVault.wrappedNativeToken();
      expect(currentWeth).to.be.equal(weth.address);
    });
    it("should return perpetual vToken address ", async function () {
      const currentVtoken = await perpVault.vToken();
      expect(currentVtoken).to.be.equal(veth.address);
    });
    it("should return perpetual portal address", async function () {
      const currentPerpPortal = await perpVault.perpPortal();
      expect(currentPerpPortal).to.be.equal(perpPortal.address);
    });
    it("should return deadlineTime", async function () {
      const currentDeadline = await perpVault.deadlineTime();
      expect(currentDeadline).to.be.equal("300");
    });
    it("should return dc native router", async function () {
      const dcNativeRouter = await perpVault.nativeRouter();
      expect(dcNativeRouter).to.be.equal(dcRouter.address);
    });
    it("should return perpReferralCode", async function () {
      const newRefCode =
        "0x6261736973706f63000000000000000000000000000000000000000000000000";
      await perpVault.connect(relayer).setPerpRefCode(newRefCode);

      const currentCode = await perpVault.perpReferralCode();
      expect(currentCode.toString()).to.be.equal(newRefCode.toString());
    });
  });

  describe("setPerpRefCode", function () {
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
    it("should set perp refCode", async function () {
      const newRefCode =
        "0x6261736973706f63000000000000000000000000000000000000000000000000";
      await perpVault.connect(relayer).setPerpRefCode(newRefCode);
      const currentRefCode = await perpVault.perpReferralCode();
      expect(currentRefCode.toString()).to.be.equal(newRefCode.toString());
    });
    it("should revert setPerpRefCode with only self", async function () {
      const data = ethers.utils.defaultAbiCoder.encode(
        ["address"],
        [relayer.address]
      );

      await expectRevert(
        perpVault.connect(clearingHouse).setPerpRefCode(data),
        "BaseAppStorage:Only relayer"
      );
    });
  });

  describe("setPerpVToken", function () {
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
    it("should set perp vToken", async function () {
      let currentBaseToken = await perpVault.vToken();
      expect(currentBaseToken.toString()).to.be.equal(veth.address);
      await perpVault.connect(relayer).setPerpVToken(usdc.address);
      currentBaseToken = await perpVault.vToken();
      expect(currentBaseToken.toString()).to.be.equal(usdc.address);
    });
    it("should revert setPerpVToken with only self", async function () {
      const newRefCode =
        "0x62519369737a6f63000000000000000000000000000000000000000000000000";
      await expectRevert(
        perpVault.connect(clearingHouse).setPerpRefCode(newRefCode),
        "BaseAppStorage:Only relayer"
      );
    });
  });
});
