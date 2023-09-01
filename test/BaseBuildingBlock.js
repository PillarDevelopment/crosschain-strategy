// const { ether, expectRevert } = require("@openzeppelin/test-helpers");
const { ethers, network } = require("hardhat");

describe("BaseBuildingBlock unit test", function () {
  let accounts;
  let relayerAddress,
    usdc,
    usdt,
    bridge,
    dcRouter,
    bbb,
    defaultEncoder,
    nativeRouter;
  const NATIVE_CHAIN_ID = 1;
  const SUPPLY_AMOUNT = 10000000;

  before(async function () {
    const bbbFactory = await ethers.getContractFactory("BBMock");
    const tokenFactory = await ethers.getContractFactory("ERC20Mock");
    const bridgeFactory = await ethers.getContractFactory("BridgeMock");

    accounts = await ethers.getSigners();
    relayerAddress = accounts[0];
    dcRouter = accounts[1];
    nativeRouter = accounts[2];

    usdc = await tokenFactory.deploy("usdc");
    usdt = await tokenFactory.deploy("usdt");
    defaultEncoder = ethers.utils.defaultAbiCoder;

    bbb = await bbbFactory.deploy();
    bridge = await bridgeFactory.deploy();

    const payload = defaultEncoder.encode(
      ["address", "address", "uint16", "address"],
      [relayerAddress.address, usdc.address, NATIVE_CHAIN_ID, dcRouter.address]
    );
    await bbb.connect(relayerAddress).initialize(payload);
    await bbb.connect(relayerAddress).setNativeRouter(nativeRouter.address);
    await bbb.connect(relayerAddress).setBridge(bridge.address);
  });
  describe("calls to  BB", function () {
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
    it("should approve to BB", async function () {
      await bbb
        .connect(relayerAddress)
        .approve(
          usdc.address,
          relayerAddress.address,
          Number(String(SUPPLY_AMOUNT))
        );
    });
    it("should back tokens to native Router", async function () {
      await usdc.mint(bbb.address, SUPPLY_AMOUNT);
      await bbb
        .connect(relayerAddress)
        .backTokensToNative(usdc.address, SUPPLY_AMOUNT);
    });
    it("should native bridge to dcRouter", async function () {
      await usdc.mint(dcRouter.address, SUPPLY_AMOUNT);
      await bbb
        .connect(relayerAddress)
        .bridge(
          usdc.address,
          SUPPLY_AMOUNT,
          NATIVE_CHAIN_ID,
          dcRouter.address,
          usdt.address
        );
    });
    it("should set Native Router to BB", async function () {
      await bbb.connect(relayerAddress).setNativeRouter(nativeRouter.address);
    });
    it("should set Relayer to BB", async function () {
      await bbb.connect(relayerAddress).setRelayer(relayerAddress.address);
    });
    it("should set Bridge to BB", async function () {
      await bbb.connect(relayerAddress).setBridge(bridge.address);
    });
    it("should set Stable to BB", async function () {
      await bbb.connect(relayerAddress).setStable(usdt.address);
    });
  });
  describe("getters", function () {
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
    it("should return nativeRouter", async function () {
      await bbb.nativeRouter();
    });
    it("should return sgBridge", async function () {
      await bbb.sgBridge();
    });
    it("should return getCurrentStable", async function () {
      await bbb.currentUSDCToken();
    });
  });
});
