
use web3::signing::Key;
use web3::transports::Http;
use web3::types::{Address, Bytes};
use web3::Web3;
include!(concat!("../gen", "/UniswapVault.rs"));

pub(crate) async fn get_adjust_position_payload(provider: &Web3<Http>, address: Address, data: Vec<u8>) -> Option<Bytes> {

    uniswap_vault::Methods::adjust_position()
    instance.methods().adjust_position(ethcontract::Bytes(data)).tx.data
}
