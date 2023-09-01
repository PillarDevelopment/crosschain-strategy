const { ethers, network } = require("hardhat");
const { expect } = require("chai");
const { expectRevert } = require("@openzeppelin/test-helpers");

describe("DcSwapperV3 unit test", function () {
  let accounts;
  let dcSwapperV3;
  let router, dcRouter, relayer, uniFactory, usdc, weth;
  const NATIVE_CHAIN_ID = "1";
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  before(async function () {
    accounts = await ethers.getSigners();
    relayer = accounts[0];
    router = accounts[1];
    uniFactory = accounts[2];
    usdc = accounts[3];
    dcRouter = accounts[4];

    const tokenFactory = await ethers.getContractFactory("ERC20Mock");
    weth = await tokenFactory.deploy("wETH");

    const swapperFactory = await ethers.getContractFactory("DcSwapperV3");

    const initParams = ethers.utils.defaultAbiCoder.encode(
      [
        "address",
        "address",
        "address",
        "address",
        "uint24[]",
        "uint16",
        "address",
        "address",
      ],
      [
        router.address,
        usdc.address,
        weth.address,
        uniFactory.address,
        [100, 500, 3000, 10000],
        NATIVE_CHAIN_ID,
        relayer.address,
        dcRouter.address,
      ]
    );
    dcSwapperV3 = await swapperFactory.deploy();
    await dcSwapperV3.initialize(initParams);
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
      const swapperFactory = await ethers.getContractFactory("DcSwapperV3");
      const dcSwapper2 = await swapperFactory.deploy();
      const deployParams = ethers.utils.defaultAbiCoder.encode(
        [
          "address",
          "address",
          "address",
          "address",
          "uint24[]",
          "uint16",
          "address",
          "address",
        ],
        [
          router.address,
          usdc.address,
          weth.address,
          uniFactory.address,
          [100, 500, 3000, 10000],
          NATIVE_CHAIN_ID,
          relayer.address,
          dcRouter.address,
        ]
      );
      await expect(dcSwapper2.initialize(deployParams)).not.to.be.reverted;
      expect(dcSwapper2.address.toString()).not.equal(ZERO_ADDRESS);
    });
    it("should revert zero address for router", async function () {
      const swapperFactory = await ethers.getContractFactory("DcSwapperV3");
      const dcSwapper2 = await swapperFactory.deploy();
      const zeroAddressParam = ethers.utils.defaultAbiCoder.encode(
        [
          "address",
          "address",
          "address",
          "address",
          "uint24[]",
          "uint16",
          "address",
          "address",
        ],
        [
          ZERO_ADDRESS,
          usdc.address,
          weth.address,
          uniFactory.address,
          [100, 500, 3000, 10000],
          NATIVE_CHAIN_ID,
          relayer.address,
          dcRouter.address,
        ]
      );
      await expectRevert(
        dcSwapper2.initialize(zeroAddressParam),
        "DcSwapperV3::initialize: routerAddress zero address"
      );
    });
    it("should revert zero address for stable token", async function () {
      const swapperFactory = await ethers.getContractFactory("DcSwapperV3");
      const dcSwapper2 = await swapperFactory.deploy();
      const zeroAddressParam = ethers.utils.defaultAbiCoder.encode(
        [
          "address",
          "address",
          "address",
          "address",
          "uint24[]",
          "uint16",
          "address",
          "address",
        ],
        [
          router.address,
          ZERO_ADDRESS,
          weth.address,
          uniFactory.address,
          [100, 500, 3000, 10000],
          NATIVE_CHAIN_ID,
          relayer.address,
          dcRouter.address,
        ]
      );
      await expectRevert(
        dcSwapper2.initialize(zeroAddressParam),
        "DcSwapperV3::initialize: usdcToken zero address"
      );
    });
    it("should revert zero address for native chain token", async function () {
      const swapperFactory = await ethers.getContractFactory("DcSwapperV3");
      const dcSwapper2 = await swapperFactory.deploy();
      const zeroAddressParam = ethers.utils.defaultAbiCoder.encode(
        [
          "address",
          "address",
          "address",
          "address",
          "uint24[]",
          "uint16",
          "address",
          "address",
        ],
        [
          router.address,
          usdc.address,
          ZERO_ADDRESS,
          uniFactory.address,
          [100, 500, 3000, 10000],
          NATIVE_CHAIN_ID,
          relayer.address,
          dcRouter.address,
        ]
      );
      await expectRevert(
        dcSwapper2.initialize(zeroAddressParam),
        "DcSwapperV3::initialize: wrappedNativeToken zero address"
      );
    });
    it("should revert zero address for dcSwapper factory", async function () {
      const swapperFactory = await ethers.getContractFactory("DcSwapperV3");
      const dcSwapper2 = await swapperFactory.deploy();
      const zeroAddressParam = ethers.utils.defaultAbiCoder.encode(
        [
          "address",
          "address",
          "address",
          "address",
          "uint24[]",
          "uint16",
          "address",
          "address",
        ],
        [
          router.address,
          usdc.address,
          weth.address,
          ZERO_ADDRESS,
          [100, 500, 3000, 10000],
          NATIVE_CHAIN_ID,
          relayer.address,
          dcRouter.address,
        ]
      );
      await expectRevert(
        dcSwapper2.initialize(zeroAddressParam),
        "DcSwapperV3::initialize: uniFactory zero address"
      );
    });
    it("should revert invalid dcSwapper fee levels", async function () {
      const swapperFactory = await ethers.getContractFactory("DcSwapperV3");
      const dcSwapper2 = await swapperFactory.deploy();
      const zeroAddressParam = ethers.utils.defaultAbiCoder.encode(
        [
          "address",
          "address",
          "address",
          "address",
          "uint24[]",
          "uint16",
          "address",
          "address",
        ],
        [
          router.address,
          usdc.address,
          weth.address,
          uniFactory.address,
          [],
          NATIVE_CHAIN_ID,
          relayer.address,
          dcRouter.address,
        ]
      );
      await expectRevert(
        dcSwapper2.initialize(zeroAddressParam),
        "DcSwapperV3::initialize: invalid uniswap fee levels"
      );
    });
    it("should revert zero id for nativeId", async function () {
      const swapperFactory = await ethers.getContractFactory("DcSwapperV3");
      const dcSwapper2 = await swapperFactory.deploy();
      const zeroAddressParam = ethers.utils.defaultAbiCoder.encode(
        [
          "address",
          "address",
          "address",
          "address",
          "uint24[]",
          "uint16",
          "address",
          "address",
        ],
        [
          router.address,
          usdc.address,
          weth.address,
          uniFactory.address,
          [100, 500, 3000, 10000],
          "0",
          relayer.address,
          dcRouter.address,
        ]
      );
      await expectRevert(
        dcSwapper2.initialize(zeroAddressParam),
        "DcSwapperV3::initialize: nativeId zero id"
      );
    });
    it("should revert zero address for relayer address", async function () {
      const swapperFactory = await ethers.getContractFactory("DcSwapperV3");
      const dcSwapper2 = await swapperFactory.deploy();
      const zeroAddressParam = ethers.utils.defaultAbiCoder.encode(
        [
          "address",
          "address",
          "address",
          "address",
          "uint24[]",
          "uint16",
          "address",
          "address",
        ],
        [
          router.address,
          usdc.address,
          weth.address,
          uniFactory.address,
          [100, 500, 3000, 10000],
          NATIVE_CHAIN_ID,
          ZERO_ADDRESS,
          dcRouter.address,
        ]
      );
      await expectRevert(
        dcSwapper2.initialize(zeroAddressParam),
        "DcSwapperV3::initialize: relayer zero address"
      );
    });

    it("should revert zero address for native dcRouter", async function () {
      const swapperFactory = await ethers.getContractFactory("DcSwapperV3");
      const dcSwapper2 = await swapperFactory.deploy();
      const zeroAddressParam = ethers.utils.defaultAbiCoder.encode(
        [
          "address",
          "address",
          "address",
          "address",
          "uint24[]",
          "uint16",
          "address",
          "address",
        ],
        [
          router.address,
          usdc.address,
          weth.address,
          uniFactory.address,
          [100, 500, 3000, 10000],
          NATIVE_CHAIN_ID,
          relayer.address,
          ethers.constants.AddressZero,
        ]
      );
      await expectRevert(
        dcSwapper2.initialize(zeroAddressParam),
        "DcSwapperV3::initialize: nativeDcRouterAddress zero address"
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
    it("should return uniswap router address", async function () {
      const currentRouter = await dcSwapperV3.amm();
      expect(currentRouter).to.be.equal(accounts[1].address);
      expect(currentRouter).to.be.equal(router.address);
    });
    it("should return uniswap factory address", async function () {
      const currentUniFactory = await dcSwapperV3.factory();
      expect(currentUniFactory).to.be.equal(accounts[2].address);
      expect(currentUniFactory).to.be.equal(uniFactory.address);
    });
    it("should return native chain token", async function () {
      const currentNativeChainToken = await dcSwapperV3.wrappedNativeToken();
      expect(currentNativeChainToken).to.be.equal(weth.address);
    });
    it("should return dc native router", async function () {
      const dcNativeRouter = await dcSwapperV3.nativeRouter();
      expect(dcNativeRouter).to.be.equal(dcRouter.address);
    });
    it("should return fee", async function () {
      let currentFee = await dcSwapperV3.fees(0);
      expect(currentFee.toString()).to.be.equal("100");
      currentFee = await dcSwapperV3.fees(1);
      expect(currentFee.toString()).to.be.equal("500");
      currentFee = await dcSwapperV3.fees(2);
      expect(currentFee.toString()).to.be.equal("3000");
      currentFee = await dcSwapperV3.fees(3);
      expect(currentFee.toString()).to.be.equal("10000");
    });
  });

  describe("SetDex", function () {
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
    it("should set dex", async function () {
      const newFactory = accounts[5];
      const newAmm = accounts[6];
      await expect(
        dcSwapperV3.connect(relayer).setDex(newFactory.address, newAmm.address)
      )
        .to.emit(dcSwapperV3, "DexUpgraded")
        .withArgs(newFactory.address, newAmm.address);
      const currentAmm = await dcSwapperV3.amm();
      expect(currentAmm).to.be.equal(accounts[6].address);
    });
    it("should revert only self", async function () {
      const fakeRelayer = accounts[7];

      await expectRevert(
        dcSwapperV3
          .connect(fakeRelayer)
          .setDex(fakeRelayer.address, fakeRelayer.address),
        "BaseAppStorage:Only relayer"
      );
    });
  });

  describe("SetFeesLevels", function () {
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
    it("should set fee levels", async function () {
      await dcSwapperV3
        .connect(relayer)
        .setFeesLevels([1000, 5000, 30000, 100000]);
      const fee0 = await dcSwapperV3.fees(0);
      expect(Number(String(fee0))).to.be.equal(1000);
    });
    it("should revert invalid uniswap fee levels", async function () {
      await expectRevert(
        dcSwapperV3.connect(relayer).setFeesLevels([]),
        "DcSwapperV3::setFeesLevels: invalid uniswap fee levels"
      );
    });
    it("should revert only self", async function () {
      const fakeRelayer = accounts[7];

      await expectRevert(
        dcSwapperV3.connect(fakeRelayer).setFeesLevels([0, 10, 13, 100]),
        "BaseAppStorage:Only relayer"
      );
    });
  });
});
