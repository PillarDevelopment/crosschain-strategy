const hre = require("hardhat");
const { ethers, upgrades } = require("hardhat");

const {CONFIG, updateConfig} = require("../../ConfigUtils");

async function main() {
    let network = hre.network.name;
    console.log('Deploying AAVE Vault contract to', network);
    if (network === 'localhost') {
        network = 'avalanche';
    }

    const AaveVaultContract = await ethers.getContractFactory('AaveVault');
    const defaultEncoder =  ethers.utils.defaultAbiCoder;

    // for aave's mintable test token
    const USDC_ADDRESS = ['fujiavax','polygonmumbai','optimismgoerli'].includes(network) ?
        CONFIG.AAVE[network].USDC : CONFIG.ASSETS.USDC[network];
    // Reset config
    CONFIG.AAVE_BB[network] = "";
    updateConfig(CONFIG);

    const initParams = defaultEncoder.encode(
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
      CONFIG.AAVE[network].POOL_ADDRESS_PROVIDER, // avalanche network
      CONFIG.AAVE[network].WETH_GATEWAY, // avalanche network
      CONFIG.AAVE[network].REWARD_CONTROLLER, // avalanche network
      CONFIG.DE_COMMAS_REGISTER, // optimism network
      USDC_ADDRESS, // avalanche network
      CONFIG.AAVE_STRATEGY[network],
      CONFIG.AAVE[network].WETH_DEBT_TOKEN, // avalanche network
      CONFIG.LZ_ENDPOINTS[network].ID, // // avalanche network
      CONFIG.ROUTERS[network]
    ]
    );

    const AaveVaultInstance = await upgrades.deployProxy(AaveVaultContract,[initParams]);

    await AaveVaultInstance.deployed();
    console.log("AaveVaultInstance deployed to:", AaveVaultInstance.address);
    CONFIG.AAVE_BB[network] = AaveVaultInstance.address;
    updateConfig(CONFIG);
    console.log("Verifying ");
    const contractAddress = AaveVaultInstance.address;
    const implAddress = await upgrades.erc1967.getImplementationAddress(contractAddress);
    console.log("AaveVaultInstance implementation: ", implAddress);
    console.log("Verification string: npx hardhat verify ",
        implAddress,
        " --network ",
        network
    );
}

async function upgrade(){
    const addressZero = ethers.constants.addressZero;
    const LATEST_DEPLOY = addressZero
    const AaveVault = await hre.ethers.getContractFactory("AaveVault");

   // console.log('Force importing proxy');
  //  await upgrades.forceImport(BSC_ROUTER, DeCommasStrategyRouter);

    console.log("Preparing upgrade...");
    const DeCommasStrategyRouterV2 = await upgrades.prepareUpgrade(LATEST_DEPLOY, AaveVault);
    console.log("DeCommasStrategyRouterV2", DeCommasStrategyRouterV2);

    const upgraded = await upgrades.upgradeProxy(LATEST_DEPLOY, AaveVault);
    console.log("DeCommasStrategyRouter upgraded with ", upgraded.address);

    console.log("Verifying ");
    const contractAddress = upgraded.address;
    const implAddress = await upgrades.erc1967.getImplementationAddress(contractAddress);
    console.log("DcPerpetualVault implementation: ", implAddress);
    // await upgrades.admin.transferProxyAdminOwnership(PROXY_OWNER_KOVAN);
    await hre.run("verify:verify", {
        address: implAddress,
    });
}

main().then(() => process.exit(0)).catch((error) => {console.error(error);process.exit(1);});
// upgrade().then(() => process.exit(0)).catch((error) => {console.error(error);process.exit(1);});
