const hre = require("hardhat");
const { ethers, upgrades} = require("hardhat");
const {updateConfig, CONFIG} = require("../../ConfigUtils");
const net = require("net");

async function main() {
    const network = hre.network.name;
    console.log('Deploying GMX Vault contract to', network);

    const GMX_VAULT = await ethers.getContractFactory('GmxVault');
    const defaultEncoder =  ethers.utils.defaultAbiCoder;

    // Reset config
    CONFIG.GMX_BB[network] = "";
    updateConfig(CONFIG);

    const initParams = defaultEncoder.encode(
    ["address","address","address", "address", "uint16","address", "address"],
    [
        CONFIG.GMX.GLP_MANAGER[network],
        CONFIG.GMX.MINT_ROUTER[network],
        CONFIG.GMX.REWARD_ROUTER[network],
        CONFIG.DE_COMMAS_REGISTER,
        CONFIG.LZ_ENDPOINTS[network].ID,
        CONFIG.ASSETS.USDC[network],
        CONFIG.ROUTERS[network],
    ]);

    const GmxVaultInstance = await upgrades.deployProxy(GMX_VAULT,[initParams]);
    await GmxVaultInstance.deployed();
    console.log("GmxVaultInstance deployed to:", GmxVaultInstance.address);
    CONFIG.GMX_BB[network] = GmxVaultInstance.address;
    updateConfig(CONFIG);

    console.log("Verifying ");
    const contractAddress = GmxVaultInstance.address;
    const implAddress = await upgrades.erc1967.getImplementationAddress(contractAddress);
    console.log("GmxVaultInstance implementation: ", implAddress);
    // await upgrades.admin.transferProxyAdminOwnership(DEPLOYER);
     await hre.run("verify:verify", {
        address: implAddress,
    });
}

async function upgrade(){
    const GmxVaultInstance_latest = " ";
    const GmxVault = await hre.ethers.getContractFactory("GmxVault");

    console.log("Preparing upgrade...");

    const upgraded = await upgrades.upgradeProxy(GmxVaultInstance_latest, GmxVault);
    console.log("GmxVaultInstance_latest upgraded with ", upgraded.address);

    console.log("Verifying ");
    const contractAddress = upgraded.address;
    const implAddress = await upgrades.erc1967.getImplementationAddress(contractAddress);
    console.log("GmxVaultInstance_latest implementation: ", implAddress);

    await hre.run("verify:verify", {
        address: implAddress,
    });
}

main().then(() => process.exit(0)).catch((error) => {console.error(error);process.exit(1);});
