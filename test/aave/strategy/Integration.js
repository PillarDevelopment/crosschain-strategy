const {expectRevert, ether} = require("@openzeppelin/test-helpers");
const {BigNumber} = require("ethers");
const {ethers, network} = require("hardhat");
const {expect} = require("chai");
const { smock } = require('@defi-wonderland/smock');
const chai = require("chai");

chai.use(smock.matchers);

const principal = BigNumber.from(ether("1").toString());
const tokenAmount = BigNumber.from("50000000");

describe("Aave Strategy integration test", function () {
    let accounts;
    let relayer, dcRouter, aaveVault, aaveStrategy, lendingPool;
    let usdc, wavax, link, wbtc, uniswapRouter, weth;
    let aToken, rewardToken, debToken;

    before(async function () {
        accounts = await ethers.getSigners();
        relayer = accounts[0];
        dcRouter = accounts[1];

        const aaveVaultFactory = await ethers.getContractFactory("AaveVault");
        // const aaveStrategyFactory = await ethers.getContractFactory("AaveStrategy");
        const aaveStrategyFactory = await smock.mock('AaveStrategy');
        const tokenFactory = await ethers.getContractFactory("ERC20Mock");
        const debTokenFactory = await ethers.getContractFactory("DebtTokenMock");
        const aaveLendingPoolFactory = await ethers.getContractFactory("AavePoolMock");
        const uniswapRouterFactory = await ethers.getContractFactory("UniswapRouterV2Mock");

        usdc = await tokenFactory.deploy("usdc");
        wavax = await tokenFactory.deploy("wavax");
        weth = await tokenFactory.deploy("weth");
        link = await tokenFactory.deploy("link");
        wbtc = await tokenFactory.deploy("wbtc");
        aToken = await tokenFactory.deploy("aToken");
        rewardToken = await tokenFactory.deploy("rewardToken");
        debToken = await debTokenFactory.deploy();
        uniswapRouter = await uniswapRouterFactory.deploy(weth.address, wavax.address);
        lendingPool = await aaveLendingPoolFactory.deploy(aToken.address, rewardToken.address);
        await link.mint(lendingPool.address, BigNumber.from(String(ether("100"))));
        await link.mint(uniswapRouter.address, BigNumber.from(String(ether("100"))));
        await wbtc.mint(lendingPool.address, BigNumber.from(String(ether("100"))));
        await wbtc.mint(uniswapRouter.address, BigNumber.from(String(ether("100"))));
        await usdc.mint(uniswapRouter.address, BigNumber.from(String(ether("100"))));

        aaveStrategy = await aaveStrategyFactory.deploy();
        // Deploy Aave BB Vault Contract
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
                lendingPool.address,
                lendingPool.address,
                relayer.address,
                usdc.address,
                aaveStrategy.address,
                debToken.address,
                1,
                dcRouter.address,
            ]
        );
        await aaveVault.initialize(initParams);

        const initStrategyParams = ethers.utils.defaultAbiCoder.encode(
            ["address", "address", "address"],
            [
                relayer.address,
                uniswapRouter.address,
                dcRouter.address,
            ]
        );
        await aaveStrategy.initialize(initStrategyParams);
        await relayer.sendTransaction({
            to: uniswapRouter.address,
            value: BigNumber.from(String(ether("1000"))),
            gasLimit: 80000
        })
        await relayer.sendTransaction({
            to: lendingPool.address,
            value: BigNumber.from(String(ether("1000"))),
            gasLimit: 80000
        })
    });

    describe("should swap tokens for tokens", function () {
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

        it("should swaps eth for tokens on uniswap v2", async function () {
            await aaveStrategy.setVariable("chainId", 123); // return fake chainId
            await usdc.mint(uniswapRouter.address, principal);
            await relayer.sendTransaction({
                to: aaveVault.address,
                value: BigNumber.from(String(ether("1000"))),
                gasLimit: 80000
            })

            const path = [ethers.constants.AddressZero, usdc.address];
            const pathWeth = [weth.address, usdc.address];

            await expect(
                aaveStrategy.connect(relayer).swap(aaveVault.address, principal, 0, path, 0)
            )
                .to.emit(aaveStrategy, "SwapEvent")
                .withArgs(aaveVault.address, pathWeth, principal, principal);
        });

        it("should swaps avax for tokens on uniswap v2(AVALANCHE)", async function () {
            await usdc.mint(uniswapRouter.address, principal);
            await relayer.sendTransaction({
                to: aaveVault.address,
                value: BigNumber.from(String(ether("1000"))),
                gasLimit: 80000
            })

            const path = [ethers.constants.AddressZero, usdc.address];
            const pathWavax = [wavax.address, usdc.address];

            await expect(
                aaveStrategy.connect(relayer).swap(aaveVault.address, principal, 0, path, 0)
            )
                .to.emit(aaveStrategy, "SwapEvent")
                .withArgs(aaveVault.address, pathWavax, principal, principal);
        });

        it("should swaps tokens for ETH on uniswap v2", async function () {
            await aaveStrategy.setVariable("chainId", 123); // return fake chainId
            await usdc.mint(aaveVault.address, tokenAmount);
            await relayer.sendTransaction({
                to: uniswapRouter.address,
                value: BigNumber.from(String(ether("1000"))),
                gasLimit: 80000
            })
            await relayer.sendTransaction({
                to: lendingPool.address,
                value: BigNumber.from(String(ether("1000"))),
                gasLimit: 80000
            })

            const path = [usdc.address, ethers.constants.AddressZero];
            const pathWeth = [usdc.address, weth.address];
            expect(
                await aaveStrategy.connect(relayer).swap(aaveVault.address, tokenAmount, 0, path, 0)
            )
                .to.emit(aaveStrategy, "SwapEvent")
                .withArgs(aaveVault.address, pathWeth, tokenAmount, tokenAmount);
        });

        it("should swaps tokens for avax on uniswap v2", async function () {
            await usdc.mint(aaveVault.address, tokenAmount);
            await relayer.sendTransaction({
                to: uniswapRouter.address,
                value: BigNumber.from(String(ether("1000"))),
                gasLimit: 80000
            })
            await relayer.sendTransaction({
                to: lendingPool.address,
                value: BigNumber.from(String(ether("1000"))),
                gasLimit: 80000
            })

            const path = [usdc.address, ethers.constants.AddressZero];
            const pathWavax = [usdc.address, wavax.address];
            expect(
                await aaveStrategy.connect(relayer).swap(aaveVault.address, tokenAmount, 0, path, 0)
            )
                .to.emit(aaveStrategy, "SwapEvent")
                .withArgs(aaveVault.address, pathWavax, tokenAmount, tokenAmount);
        });

        it("should swaps tokens for tokens on uniswap v2", async function () {
            await usdc.mint(aaveVault.address, tokenAmount);
            await relayer.sendTransaction({
                to: uniswapRouter.address,
                value: BigNumber.from(String(ether("1000"))),
                gasLimit: 80000
            })
            await relayer.sendTransaction({
                to: lendingPool.address,
                value: BigNumber.from(String(ether("1000"))),
                gasLimit: 80000
            })

            const path = [usdc.address, wavax.address, link.address];
            expect(
                await aaveStrategy.connect(relayer).swap(aaveVault.address, tokenAmount, 0, path, 0)
            )
                .to.emit(aaveStrategy, "SwapEvent")
                .withArgs(aaveVault.address, path, tokenAmount, tokenAmount);
        });

        it("should revert swaps with wrong path", async function () {
            await usdc.mint(uniswapRouter.address, principal);
            await relayer.sendTransaction({
                to: aaveVault.address,
                value: BigNumber.from(String(ether("1000"))),
                gasLimit: 80000
            })

            const path = [ethers.constants.AddressZero, usdc.address, ethers.constants.AddressZero];

            await expectRevert.unspecified(aaveStrategy.connect(relayer).swap(aaveVault.address, principal, 0, path, 0), "");
        });

        it("should revert swaps with wrong vault address", async function () {
            await usdc.mint(uniswapRouter.address, principal);
            await relayer.sendTransaction({
                to: aaveVault.address,
                value: BigNumber.from(String(ether("1000"))),
                gasLimit: 80000
            })

            const path = [ethers.constants.AddressZero, usdc.address, ethers.constants.AddressZero];

            await expect(
                aaveStrategy.connect(relayer).swap(ethers.constants.AddressZero, principal, 0, path, 0)
            ).to.be.revertedWith("AaveStrategy::swap: wrong vault address");
        });
    });
});
