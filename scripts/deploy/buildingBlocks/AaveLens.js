const hre = require("hardhat");
const { ethers } = require("hardhat");
const {CONFIG, updateConfig} = require("../../ConfigUtils");

async function main() {
    let network = hre.network.name;
    console.log('Deploying AAVE Lens contract to', network);
    if (network === 'localhost') {
        network = 'avalanche';
    }

    // Reset config
    CONFIG.AAVE_LENS[network] = "";
    updateConfig(CONFIG);

    const AaveLensContract = await ethers.getContractFactory('AaveLens');
    const AaveLensInstance = await AaveLensContract.deploy(
        CONFIG.AAVE[network].POOL_ADDRESS_PROVIDER,
        CONFIG.AAVE[network].REWARD_CONTROLLER
    );

    await AaveLensInstance.deployed();
    console.log("AaveLensInstance deployed to:", AaveLensInstance.address);
    CONFIG.AAVE_LENS[network] = AaveLensInstance.address;
    updateConfig(CONFIG);
    console.log("Verification string: npx hardhat verify ",
        AaveLensInstance.address,
        CONFIG.AAVE[network].POOL_ADDRESS_PROVIDER,
        CONFIG.AAVE[network].REWARD_CONTROLLER,
        " --network ",
        network
    );
}
main().then(() => process.exit(0)).catch((error) => {console.error(error);process.exit(1);});
