const { ethers, network } = require("hardhat");
const { expect } = require("chai");
const { expectRevert } = require("@openzeppelin/test-helpers");

describe("DcSwapperV3 integration test", function () {
  let accounts;
  let dcSwapperV3;
  let relayer, dcRouter, router, uniFactory, usdc, weth, dai;
  let lzNativeFee;
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  const TOKEN_AMOUNT = "100000000";
  const WETH_AMOUNT = "100000000000000000";

  before(async function () {
    const NATIVE_CHAIN_ID = "1";
    accounts = await ethers.getSigners();
    relayer = accounts[0];
    dcRouter = accounts[1];
    lzNativeFee = ethers.utils.parseEther("0.1");

    const uniRouterV3Factory = await ethers.getContractFactory(
      "UniswapRouterV3Mock"
    );
    const wethFactory = await ethers.getContractFactory("WETH9Mock");
    const tokenFactory = await ethers.getContractFactory("ERC20Mock");
    const swapperFactory = await ethers.getContractFactory("DcSwapperV3");
    const uniFactoryV3Factory = await ethers.getContractFactory(
      "UniswapFactoryV3Mock"
    );

    router = await uniRouterV3Factory.deploy();
    usdc = await tokenFactory.deploy("USDC");
    weth = await wethFactory.deploy();
    dai = await tokenFactory.deploy("DAI");

    uniFactory = await uniFactoryV3Factory.deploy();
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
    await uniFactory.createPool(usdc.address, dai.address, "100");
    await uniFactory.createPool(usdc.address, dai.address, "500");
    await uniFactory.createPool(usdc.address, dai.address, "3000");
    await uniFactory.createPool(usdc.address, dai.address, "10000");
  });

  describe("isTokenSupported", function () {
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
    it("should return isTokenSupported", async function () {
      const bridgeToken = usdc.address;
      const tokens = [dai.address];
      const supported = await dcSwapperV3.isTokensSupported(
        bridgeToken,
        tokens
      );
      expect(supported[0]).to.be.equal(true);
    });
    it("should return isTokenSupported with same tokens", async function () {
      const bridgeToken = usdc.address;
      const tokens = [usdc.address];
      const supported = await dcSwapperV3.isTokensSupported(
        bridgeToken,
        tokens
      );
      expect(supported[0]).to.be.equal(true);
    });
    it("should return isTokenSupported with native asset", async function () {
      await uniFactory.createPool(usdc.address, ZERO_ADDRESS, "1");
      await uniFactory.createPool(usdc.address, ZERO_ADDRESS, "2");
      await uniFactory.createPool(usdc.address, ZERO_ADDRESS, "3");
      await uniFactory.createPool(usdc.address, ZERO_ADDRESS, "4");

      await uniFactory.createPool(ZERO_ADDRESS, usdc.address, "1");
      await uniFactory.createPool(ZERO_ADDRESS, usdc.address, "2");
      await uniFactory.createPool(ZERO_ADDRESS, usdc.address, "3");
      await uniFactory.createPool(ZERO_ADDRESS, usdc.address, "4");

      const bridgeToken = usdc.address;
      const tokens = [usdc.address, ZERO_ADDRESS];
      const supported = await dcSwapperV3.isTokensSupported(
        bridgeToken,
        tokens
      );
      expect(supported[0]).to.be.equal(true);
    });
  });

  describe("isPairsSupported", function () {
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
    it("should return true for isPairsSupported", async function () {
      const tokens = [[usdc.address, dai.address]];
      const supported = await dcSwapperV3.isPairsSupported(tokens);
      expect(supported[0]).to.be.equal(true);
    });
    it("should return false for isPairsSupported", async function () {
      const tokens = [[uniFactory.address, relayer.address]];
      const supported = await dcSwapperV3.isPairsSupported(tokens);
      expect(supported[0]).to.be.equal(false);
    });
  });

  describe("getBestFees", function () {
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
    it("should return getBestFees", async function () {
      const [, fee, tokenA, tokenB] = await dcSwapperV3.getBestFee(
        usdc.address,
        dai.address
      );
      expect(fee.toString()).to.be.equal("100");
      expect(tokenA.toString()).to.be.equal(usdc.address);
      expect(tokenB.toString()).to.be.equal(dai.address);
    });
    it("should return getBestFees with same tokens", async function () {
      const [, fee, tokenA1, tokenA2] = await dcSwapperV3.getBestFee(
        usdc.address,
        usdc.address
      );
      expect(fee.toString()).to.be.equal("0");
      expect(tokenA1.toString()).to.be.equal(usdc.address);
      expect(tokenA2.toString()).to.be.equal(usdc.address);
    });
    it("should return getBestFees with unsupported pair", async function () {
      const tokenFactory = await ethers.getContractFactory("ERC20Mock");
      const usdt = await tokenFactory.deploy("USDT");
      const vAvax = await tokenFactory.deploy("wAvax");

      const [pool0, fee, tokenA1, tokenA2] = await dcSwapperV3.getBestFee(
        usdt.address,
        vAvax.address
      );
      expect(pool0.toString()).to.be.equal(ZERO_ADDRESS);
      expect(fee.toString()).to.be.equal("0");
      expect(tokenA1.toString()).to.be.equal(usdt.address);
      expect(tokenA2.toString()).to.be.equal(vAvax.address);
    });
    it("should return getBestFees with inverted tokens", async function () {
      const [, fee, tokenA, tokenB] = await dcSwapperV3.getBestFee(
        dai.address,
        usdc.address
      );
      expect(fee.toString()).to.be.equal("100");
      expect(tokenA.toString()).to.be.equal(dai.address);
      expect(tokenB.toString()).to.be.equal(usdc.address);
    });
    it("should return getBestFees with wETH", async function () {
      await uniFactory.createPool(weth.address, dai.address, "100");
      await uniFactory.createPool(dai.address, weth.address, "100");
      await uniFactory.createPool(weth.address, usdc.address, "100");
      await uniFactory.createPool(usdc.address, weth.address, "100");

      let [, fee, tokenA, tokenB] = await dcSwapperV3.getBestFee(
        ZERO_ADDRESS,
        usdc.address
      );
      expect(fee.toString()).to.be.equal("100");
      expect(tokenA.toString()).to.be.equal(weth.address);
      expect(tokenB.toString()).to.be.equal(usdc.address);

      [, fee, tokenA, tokenB] = await dcSwapperV3.getBestFee(
        dai.address,
        ZERO_ADDRESS
      );
      expect(fee.toString()).to.be.equal("100");
      expect(tokenA.toString()).to.be.equal(dai.address);
      expect(tokenB.toString()).to.be.equal(weth.address);
    });
  });

  describe("Swap", function () {
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
    it("should swap stable token to stable token", async function () {
      await usdc.mint(dcSwapperV3.address, TOKEN_AMOUNT);
      let daiBalance = await dai.balanceOf(dcSwapperV3.address);
      const usdcBalance = await usdc.balanceOf(dcSwapperV3.address);
      expect(daiBalance.toString()).to.be.equal("0");
      expect(usdcBalance.toString()).to.be.equal(TOKEN_AMOUNT);

      await expect(
        dcSwapperV3
          .connect(relayer)
          .swap(usdc.address, dai.address, TOKEN_AMOUNT, dcSwapperV3.address, {
            value: lzNativeFee,
          })
      )
        .to.emit(dcSwapperV3, "Swapped")
        .withArgs(usdc.address, dai.address, dcSwapperV3.address, TOKEN_AMOUNT);
      daiBalance = await dai.balanceOf(dcSwapperV3.address);
      expect(daiBalance.toString()).to.be.equal(TOKEN_AMOUNT);
    });
    it("should reverse swap stable token to stable token", async function () {
      await dai.mint(dcSwapperV3.address, TOKEN_AMOUNT);
      let usdcBalance = await usdc.balanceOf(dcSwapperV3.address);
      const daiBalance = await dai.balanceOf(dcSwapperV3.address);
      expect(usdcBalance.toString()).to.be.equal("0");
      expect(daiBalance.toString()).to.be.equal(TOKEN_AMOUNT);

      await expect(
        dcSwapperV3
          .connect(relayer)
          .swap(dai.address, usdc.address, TOKEN_AMOUNT, dcSwapperV3.address, {
            value: lzNativeFee,
          })
      )
        .to.emit(dcSwapperV3, "Swapped")
        .withArgs(dai.address, usdc.address, dcSwapperV3.address, TOKEN_AMOUNT);
      usdcBalance = await usdc.balanceOf(dcSwapperV3.address);
      expect(usdcBalance.toString()).to.be.equal(TOKEN_AMOUNT);
    });
    it("should swap native chain token to stable token", async function () {
      await uniFactory.createPool(dai.address, weth.address, "100");
      await uniFactory.createPool(weth.address, dai.address, "100");
      await uniFactory.createPool(dai.address, weth.address, "500");
      await uniFactory.createPool(weth.address, dai.address, "500");
      let daiBalance = await dai.balanceOf(dcSwapperV3.address);
      expect(daiBalance.toString()).to.be.equal("0");

      await expect(
        dcSwapperV3
          .connect(relayer)
          .swap(ZERO_ADDRESS, dai.address, WETH_AMOUNT, dcSwapperV3.address, {
            value: lzNativeFee,
          })
      )
        .to.emit(dcSwapperV3, "Swapped")
        .withArgs(weth.address, dai.address, dcSwapperV3.address, WETH_AMOUNT);
      daiBalance = await dai.balanceOf(dcSwapperV3.address);
      expect(daiBalance.toString()).to.be.equal(WETH_AMOUNT);
    });
    it("should swap stable token to native chain token", async function () {
      await usdc.mint(dcSwapperV3.address, TOKEN_AMOUNT);
      await weth.mint(dcSwapperV3.address, TOKEN_AMOUNT);
      await uniFactory.createPool(usdc.address, weth.address, "100");
      await uniFactory.createPool(weth.address, usdc.address, "100");
      await uniFactory.createPool(usdc.address, weth.address, "500");
      await uniFactory.createPool(weth.address, usdc.address, "500");
      let wethBalance = await weth.balanceOf(dcSwapperV3.address);
      expect(wethBalance.toString()).to.be.equal("100000000");

      await expect(
        dcSwapperV3
          .connect(relayer)
          .swap(usdc.address, ZERO_ADDRESS, TOKEN_AMOUNT, dcSwapperV3.address)
      )
        .to.emit(dcSwapperV3, "Swapped")
        .withArgs(
          usdc.address,
          weth.address,
          dcSwapperV3.address,
          TOKEN_AMOUNT
        );
      wethBalance = await weth.balanceOf(dcSwapperV3.address);
      expect(wethBalance.toString()).to.be.equal(TOKEN_AMOUNT);
    });
    it("should revert swap with deposit or bridge swap amountIn", async function () {
      await uniFactory.createPool(dai.address, weth.address, "100");
      await uniFactory.createPool(weth.address, dai.address, "100");
      await uniFactory.createPool(dai.address, weth.address, "500");
      await uniFactory.createPool(weth.address, dai.address, "500");

      await expectRevert(
        dcSwapperV3
          .connect(relayer)
          .swap(weth.address, dai.address, WETH_AMOUNT, dcSwapperV3.address, {
            value: lzNativeFee,
          }),
        "DcSwapperV3::swap: deposit or bridge swap amountIn"
      );
    });
    it("should revert swap with amount-mismatch", async function () {
      const incorrectAmount = "200000000000000000";

      await expectRevert(
        dcSwapperV3
          .connect(relayer)
          .swap(
            ZERO_ADDRESS,
            dai.address,
            incorrectAmount,
            dcSwapperV3.address,
            { value: lzNativeFee }
          ),
        "DcSwapperV3::swap: amount mismatch"
      );
    });
    it("should revert swap no-pool", async function () {
      const tokenFactory = await ethers.getContractFactory("ERC20Mock");
      const usdt = await tokenFactory.deploy("USDT");
      await usdt.mint(dcSwapperV3.address, TOKEN_AMOUNT);

      await expectRevert(
        dcSwapperV3
          .connect(relayer)
          .swap(usdt.address, dai.address, TOKEN_AMOUNT, dcSwapperV3.address),
        "DcSwapperV3::swap: no pool"
      );
    });
    it("should revert only self", async function () {
      const TOKEN_AMOUNT = "100000000";
      const dai = accounts[6];
      const fakeRelayer = accounts[7];

      await expectRevert(
        dcSwapperV3
          .connect(fakeRelayer)
          .swap(usdc.address, dai.address, TOKEN_AMOUNT, fakeRelayer.address),
        "BaseAppStorage:Only relayer"
      );
    });
  });
});
