# Protocol deployment

Execute `./scripts/deploy/full_deploy.sh -e testnet|mainnet`

#### Steps included:
* Deploy routers on supported chains
* Deploy BB Fabrics
* Deploy BB implementations 
  * AAVE
  * GMX (only for mainnet)



### Examples of deploy

#### Deploy all for testnet 
`./scripts/deploy/full_deploy.sh -e testnet`

#### Deploy all except for testnet
`./scripts/deploy/full_deploy.sh -e testnet`

#### Deploy only AAVE strategy for mainnet
`export DEPLOY_BB_FABRIC=false`  
`export DEPLOY_ROUTERS=false`  
`export DEPLOY_AAVE_VAULT=false`  
`export DEPLOY_AAVE_LENS=false`  
`export DEPLOY_GMX_VAULT=false`

`./scripts/deploy/full_deploy.sh -e mainnet`


### Full variable list:
|         Name         | default | comment                    |
|:--------------------:|:-------:|----------------------------|
|   DEPLOY_BB_FABRIC   |  true   |                            |
|    DEPLOY_ROUTERS    |  true   |                            |
|  DEPLOY_AAVE_VAULT   |  true   |                            |
|   DEPLOY_AAVE_LENS   |  true   |                            |
| DEPLOY_AAVE_STRATEGY |  true   | only available for mainnet |
|   DEPLOY_GMX_VAULT   |  true   | only available for mainnet |


