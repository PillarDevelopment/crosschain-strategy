
use web3::signing::Key;
use web3::transports::Http;
use web3::types::{Address, Bytes};
use web3::Web3;
include!(concat!("../gen", "/DcPerpetualVault.rs"));

pub(crate) async fn get_adjust_position_payload(provider: &Web3<Http>, address: Address, position_change: i64) -> Option<Bytes> {
    let instance = dc_perpetual_vault::Contract::at(provider, address);
    instance.methods().adjust_position(web3::Bytes(position_change.as_byte_slice())).tx.data
}
