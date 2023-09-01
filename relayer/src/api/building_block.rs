
use web3::signing::Key;
use web3::transports::Http;
use web3::types::{Address, Bytes};
use web3::Web3;
include!(concat!("../gen", "/BaseBuildingBlock.rs"));

/// Raw bytes that should be passed to the relayer
pub(crate) async fn adjust_position_payload(provider: &Web3<Http>, address: Address, data: Vec<u8>) -> Option<Bytes> {
    let instance = base_building_block::Contract::at(provider, address);
    instance.methods().adjust_position(ethcontract::Bytes(data)).tx.data
}
