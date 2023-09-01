const { ethers, network } = require("hardhat");
const { expect } = require("chai");
const { ether, BN } = require("@openzeppelin/test-helpers");
const { smock } = require("@defi-wonderland/smock");
const chai = require("chai");
const { BigNumber } = require("ethers");

chai.use(smock.matchers);

describe("GmxVault integration test", function () {
  const NATIVE_CHAIN_ID = 1;

  let accounts;
  let gmxBlockFactory, gmxBlock;
  let relayer,
    dcRouter,
    glpManager,
    mintRouter,
    rewardRouter,
    gmxVault,
    glpToken,
    glpTrackerToken;
  let usdc, weth;

  before(async function () {
    accounts = await ethers.getSigners();
    relayer = accounts[0];
    dcRouter = accounts[1];

    const tokenFactory = await smock.mock("ERC20Mock");

    usdc = await tokenFactory.deploy("usdc");
    weth = await tokenFactory.deploy("weth");
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

  describe("Test buyGlP", function () {
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

    it("should stake usdc", async function () {
      const stakeAmount = 100000000;
      const minUSDG = 2;
      const minGLP = 1;
      const boughtAmount = 100;

      await usdc.mint(gmxBlock.address, stakeAmount);
      // mock return
      await mintRouter.mintAndStakeGlp.returns(boughtAmount);
      await glpTrackerToken.balanceOf.returnsAtCall(0, 0);
      await glpTrackerToken.balanceOf.returnsAtCall(1, boughtAmount);

      await expect(
        gmxBlock
          .connect(relayer)
          .buyGLP(usdc.address, stakeAmount, minUSDG, minGLP)
      )
        .to.emit(gmxBlock, "BuyingEvent")
        .withArgs(usdc.address, stakeAmount, boughtAmount);

      expect(mintRouter.mintAndStakeGlp).to.have.been.calledWith(
        usdc.address,
        stakeAmount,
        minUSDG,
        minGLP
      );
      expect(usdc.approve).to.have.been.calledWith(
        mintRouter.address,
        stakeAmount
      );
      expect(usdc.approve).to.have.been.calledWith(
        glpManager.address,
        stakeAmount
      );
    });

    it("should revert stake usdc when tracker tokens were not transferred", async function () {
      const stakeAmount = 100000000;
      const minUSDG = 2;
      const minGLP = 1;
      const boughtAmount = 100;

      await usdc.mint(gmxBlock.address, stakeAmount);
      // mock return
      await mintRouter.mintAndStakeGlp.returns(boughtAmount);
      await glpTrackerToken.balanceOf.returns(0);
      await expect(
        gmxBlock
          .connect(relayer)
          .buyGLP(usdc.address, stakeAmount, minUSDG, minGLP)
      ).to.be.revertedWith("GMX Vault::buyGLP::glp buying failed");
    });

    it("should stake native asset", async function () {
      const stakeAmount = 100000000;
      const minUSDG = 2;
      const minGLP = 1;
      const boughtAmount = 100;

      await relayer.sendTransaction({
        to: gmxBlock.address,
        value: stakeAmount.toString(),
      });
      // mock return
      await mintRouter.mintAndStakeGlpETH.returns(boughtAmount);

      await expect(
        gmxBlock
          .connect(relayer)
          .buyGLP(ethers.constants.AddressZero, stakeAmount, minUSDG, minGLP)
      )
        .to.emit(gmxBlock, "BuyingEvent")
        .withArgs(ethers.constants.AddressZero, stakeAmount, boughtAmount);

      expect(mintRouter.mintAndStakeGlpETH).to.have.been.calledWith(
        minUSDG,
        minGLP
      );
    });
  });

  describe("Test sellGLP", function () {
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

    it("should unstake usdc", async function () {
      const unstakeAmount = 100000000;
      const minOut = 2;
      const unstakedAmount = 100;

      // mock return
      await mintRouter.unstakeAndRedeemGlp.returns(unstakedAmount);
      await usdc.balanceOf.returnsAtCall(2, 0);
      await usdc.balanceOf.returnsAtCall(3, unstakedAmount);

      await expect(
        gmxBlock.connect(relayer).sellGLP(usdc.address, unstakeAmount, minOut)
      )
        .to.emit(gmxBlock, "SellingEvent")
        .withArgs(usdc.address, unstakeAmount, unstakedAmount);

      expect(mintRouter.unstakeAndRedeemGlp).to.have.been.calledWith(
        usdc.address,
        unstakeAmount,
        minOut,
        gmxBlock.address
      );
    });

    it("should revert unstake usdc when no tokens were received", async function () {
      const unstakeAmount = 100000000;
      const minOut = 2;
      const unstakedAmount = 100;

      // mock return
      await mintRouter.unstakeAndRedeemGlp.returns(unstakedAmount);
      await usdc.balanceOf.returns(0);

      await expect(
        gmxBlock.connect(relayer).sellGLP(usdc.address, unstakeAmount, minOut)
      ).to.be.revertedWith("GMX Vault::sellGLP::glp selling failed");
    });

    it("should unstake native asset", async function () {
      const unstakeAmount = 100000000;
      const minOut = 2;
      const unstakedAmount = 100;

      // mock return
      await mintRouter.unstakeAndRedeemGlpETH.returns(unstakedAmount);

      await expect(
        gmxBlock
          .connect(relayer)
          .sellGLP(ethers.constants.AddressZero, unstakeAmount, minOut)
      )
        .to.emit(gmxBlock, "SellingEvent")
        .withArgs(ethers.constants.AddressZero, unstakeAmount, unstakedAmount);

      expect(mintRouter.unstakeAndRedeemGlpETH).to.have.been.calledWith(
        unstakeAmount,
        minOut,
        gmxBlock.address
      );
    });
  });

  describe("Test claimRewards", function () {
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

    it("should pass params to the reward router", async function () {
      await expect(
        gmxBlock
          .connect(relayer)
          .claimRewards(true, true, true, true, true, true, true)
      ).not.to.be.reverted;

      expect(rewardRouter.handleRewards).to.have.been.calledWith(
        true,
        true,
        true,
        true,
        true,
        true,
        true
      );

      await expect(
        gmxBlock
          .connect(relayer)
          .claimRewards(false, false, false, false, false, false, false)
      ).not.to.be.reverted;

      expect(rewardRouter.handleRewards).to.have.been.calledWith(
        false,
        false,
        false,
        false,
        false,
        false,
        false
      );
    });
  });

  describe("Test getTVL", function () {
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

    it("should calculate tvl", async function () {
      const AumInUSDG = ether("100");
      const glpTokenTotalSupply = ether("10");
      const glpTrackerTokenBlockBalance = ether("2");

      await glpManager.getAumInUsdg.returns(AumInUSDG.toString());
      await glpToken.totalSupply.returns(glpTokenTotalSupply.toString());
      await glpTrackerToken.balanceOf.returns(
        glpTrackerTokenBlockBalance.toString()
      );

      const tvl = await gmxBlock.getTvl();

      expect(tvl.toString()).to.be.equal(
        AumInUSDG.div(glpTokenTotalSupply)
          .mul(glpTrackerTokenBlockBalance)
          .toString()
      );
    });
  });

  describe("Test getWeights", function () {
    let snapshotId;
    let wethPoolValue;
    let decimal30,
      decimal18,
      aum,
      maxPrice,
      poolAmount,
      ten,
      usdcDecimals,
      wethDecimals,
      guaranteedUsd,
      reservedAmount;

    beforeEach(async function () {
      snapshotId = await network.provider.request({
        method: "evm_snapshot",
        params: [],
      });

      decimal30 = BN(10).pow(BN(30));
      decimal18 = BN(10).pow(BN(18));
      aum = BN(100).mul(decimal30);
      maxPrice = ether("2");
      poolAmount = ether("8");
      ten = BN(10);
      usdcDecimals = BN(6);
      wethDecimals = BN(18);
      guaranteedUsd = ether("1");
      reservedAmount = ether("3");

      wethPoolValue = poolAmount
        .sub(reservedAmount)
        .mul(maxPrice)
        .div(ten.pow(wethDecimals))
        .add(guaranteedUsd);

      // mock returns
      await glpManager.getAum.returns(aum.toString());
      await gmxVault.getMaxPrice.returns(maxPrice.toString());
      await gmxVault.poolAmounts.returns(poolAmount.toString());
      await gmxVault.tokenDecimals
        .whenCalledWith(usdc.address)
        .returns(usdcDecimals.toString());
      await gmxVault.tokenDecimals
        .whenCalledWith(weth.address)
        .returns(wethDecimals.toString());
      await gmxVault.stableTokens.whenCalledWith(usdc.address).returns(true);
      await gmxVault.stableTokens.whenCalledWith(weth.address).returns(false);
      await gmxVault.guaranteedUsd.returns(guaranteedUsd.toString());
      await gmxVault.reservedAmounts.returns(reservedAmount.toString());
    });

    afterEach(async function () {
      await network.provider.request({
        method: "evm_revert",
        params: [snapshotId],
      });
    });

    it("should revert on invalid address in weights params", async function () {
      await expect(
        gmxBlock.getWeights([ethers.constants.AddressZero, usdc.address])
      ).to.be.revertedWith("GMX Vault::getWeights::zero asset");
    });

    it("should calculate asset weights without shorts", async function () {
      // usdcAmount = poolAmount * maxPrice / 10**6
      const usdcAmount = poolAmount.mul(maxPrice).div(ten.pow(usdcDecimals));
      const expectedUSDCWeight = BigNumber.from(
        // weight = poolAmount * 1e18 / AUM
        usdcAmount.mul(decimal18).div(aum).toString()
      );

      const expectedWETHWeight = BigNumber.from(
        // wethPoolValue * 1e18 / aum
        wethPoolValue.mul(decimal18).div(aum).toString()
      );

      await gmxVault.globalShortSizes.returns(0);

      const weights = await gmxBlock.getWeights([usdc.address, weth.address]);

      expect(weights).to.deep.equal([expectedUSDCWeight, expectedWETHWeight]);
    });

    it("should calculate weth weights with profit in shorts", async function () {
      const globalShort = ether("2");
      const shortDelta = ether("1");
      const hasProfit = true;

      await gmxVault.globalShortSizes.returns(globalShort.toString());
      await glpManager.getGlobalShortDelta.returns([
        shortDelta.toString(),
        hasProfit,
      ]);

      const weightsWithProfit = await gmxBlock.getWeights([weth.address]);

      const weightWithoutDelta = BigNumber.from(
        // (wethPoolValue - delta) * 1e18 / aum
        wethPoolValue.sub(shortDelta).mul(decimal18).div(aum).toString()
      );
      expect(weightsWithProfit).to.deep.equal([weightWithoutDelta]);

      expect(glpManager.getGlobalShortDelta).to.have.been.calledWith(
        weth.address,
        maxPrice.toString(),
        globalShort.toString()
      );
    });

    it("should calculate weth weights without profit in shorts", async function () {
      const globalShort = ether("2");
      const shortDelta = ether("1");
      const hasProfit = false;

      await gmxVault.globalShortSizes.returns(globalShort.toString());
      await glpManager.getGlobalShortDelta.returns([
        shortDelta.toString(),
        hasProfit,
      ]);

      const weightsWithoutProfit = await gmxBlock.getWeights([weth.address]);

      const weightWithDelta = BigNumber.from(
        // (wethPoolValue + delta) * 1e18 / aum
        wethPoolValue.add(shortDelta).mul(decimal18).div(aum).toString()
      );
      expect(weightsWithoutProfit).to.deep.equal([weightWithDelta]);
    });
  });
});
