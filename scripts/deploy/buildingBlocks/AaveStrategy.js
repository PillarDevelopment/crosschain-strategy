const hre = require("hardhat");
const {ethers, upgrades} = require("hardhat");

const {CONFIG, updateConfig} = require("../../ConfigUtils");

async function main() {
    let network = hre.network.name;
    console.log('Deploying AAVE Strategy contract to', network);
    if (network === 'localhost') {
        network = 'avalanche';
    }
    const AAVE_STRAT = await ethers.getContractFactory('AaveStrategy');

    // Reset config
    CONFIG.AAVE_STRATEGY[network] = "";
    updateConfig(CONFIG);

    const initParams = ethers.utils.defaultAbiCoder.encode(
        [
            "address",
            "address",
            "address",
        ],
        [
            CONFIG.DE_COMMAS_REGISTER,
            CONFIG.UNISWAP_V2_ROUTER[network],
            CONFIG.ROUTERS[network]
        ]
    );
    const AaveStrategyInstance = await upgrades.deployProxy(
        AAVE_STRAT, [initParams]
    );

    await AaveStrategyInstance.deployed();
    console.log("Aave Strategy Instance deployed to:", AaveStrategyInstance.address);
    CONFIG.AAVE_STRATEGY[network] = AaveStrategyInstance.address;
    updateConfig(CONFIG);

    console.log("Verification string: npx hardhat verify ",
        AaveStrategyInstance.address,
        CONFIG.UNISWAP_V2_ROUTER[network],
        CONFIG.ROUTERS[network],
        " --network ",
        network
    );
}

async function upgrade() {
    let network = hre.network.name;
    console.log('Deploying AAVE Strategy contract to', network);
    if (network === 'localhost') {
        network = 'avalanche';
    }

    const AAVE_STRAT = await ethers.getContractFactory('AaveStrategy');

    console.log("Preparing upgrade...");
    const address = CONFIG.AAVE_STRATEGY[network];
    // const StrategyV2 = await upgrades.prepareUpgrade(address, AAVE_STRAT);

    const upgraded = await upgrades.upgradeProxy(address, AAVE_STRAT);
    console.log("AaveStrategy upgraded with ", upgraded.address);
}

main().then(() => process.exit(0)).catch((error) => {
    console.error(error);
    process.exit(1);
});
//
// upgrade().then(() => process.exit(0)).catch((error) => {
//     process.exit(1);
// });
