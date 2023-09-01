Help()
{
  echo "==========HELP=========="
  echo "Deploy DC protocol to the target environment"
  echo
  echo "Syntax: deploy_full.sh -e testnet|mainnet"
  echo
  echo "env flags for granular deployment: DEPLOY_REGISTRY"
  echo "DEPLOY_BB_FABRIC, DEPLOY_ROUTERS, DEPLOY_AAVE_VAULT, DEPLOY_AAVE_LENS"
  echo "DEPLOY_AAVE_STRATEGY, DEPLOY_GMX_VAULT"
  echo "If flag is set to false corresponding contract will not be deployed"
  echo "default is true"
  echo
}

# Parse command arguments
while getopts e:h: flag
do
    case "${flag}" in
        h) Help
           exit;;
        e) env=${OPTARG};;
       \?) echo "Error: Invalid option"
           exit;;
    esac
done

# Update addresses
eval "npx hardhat update" || exit $?

# Define contract deployment networks
case $env in
    testnet)
      registry_network="optimismgoerli"
      declare -a fabric_networks=("fujiavax")
      declare -a router_networks=("fujiavax" "polygonmumbai" "bsctestnet" "optimismgoerli")
      aave_network="fujiavax"
      ;;
    mainnet)
      registry_network="optimism"
      declare -a fabric_networks=("avalanche" "arbitrum")
      declare -a router_networks=("avalanche" "optimism" "bsc_mainnet" "polygon" "fantom" "arbitrum")
      aave_network="avalanche"
      gmx_network="arbitrum"
      ;;
    local)
      registry_network="localhost"
      declare -a fabric_networks=("localhost")
      declare -a router_networks=("localhost")
      aave_network="localhost"
      ;;
    *)
      echo "Error invalid environment.\n"
      Help
      exit;;
esac

echo "Running deploy for $env environment";
# Load envs
export $(grep -v '^#' .env | xargs)

if [[ "${DEPLOY_REGISTRY:true}" == "true" ]]; then
  eval "npx hardhat run scripts/deploy/StrategyRegistry.js --network $registry_network" || exit $?
else
  echo "Skipping registry deploy"
fi

if [[ "${DEPLOY_BB_FABRIC:true}" == "true" ]]; then
  echo "Deploying BB Fabrics:"
  for network in "${fabric_networks[@]}"
  do
     eval "npx hardhat run scripts/deploy/BBFabric.js --network $network" || exit $?
  done
else
  echo "Skipping fabric deploy"
fi

if [[ "${DEPLOY_ROUTERS:true}" == "true" ]]; then
  echo "Deploying Routers:"
  for network in "${router_networks[@]}"
  do
     eval "npx hardhat run scripts/deploy/DcRouter.js --network $network" || exit $?
  done
else
  echo "Skipping routers deploy"
fi

if [[ "${DEPLOY_AAVE_STRATEGY:true}" == "true" ]]; then
  eval "npx hardhat run scripts/deploy/buildingBlocks/AaveStrategy.js --network $aave_network" || exit $?
else
  echo "Skipping AaveStrategy deploy"
fi

if [[ "${DEPLOY_AAVE_VAULT:true}" == "true" ]]; then
  eval "npx hardhat run scripts/deploy/buildingBlocks/AaveVault.js --network $aave_network" || exit $?
else
  echo "Skipping AaveVault deploy"
fi
if [[ "${DEPLOY_AAVE_LENS:true}" == "true" ]]; then
  eval "npx hardhat run scripts/deploy/buildingBlocks/AaveLens.js --network $aave_network" || exit $?
else
  echo "Skipping AaveLens deploy"
fi

# GMX exists only in mainnet for now
if [ -z "$gmx_network" ]; then
  echo "Skipping GMX deployment"
else
  if [[ "${DEPLOY_GMX_VAULT:true}" == "true" ]]; then
    eval "npx hardhat run scripts/deploy/buildingBlocks/GmxVault.js --network $gmx_network" || exit $?
  else
    echo "Skipping GmxVault deploy"
  fi
fi

echo "Finished"

