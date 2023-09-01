mod relayer;
mod building_block;
mod uniswap_block;
mod perp_block;

use std::borrow::{Borrow, BorrowMut};
use reqwest::{Error, StatusCode};
use serde::{Deserialize, Serialize};
use rocket_contrib::json::Json;

use ethcontract::{Account, PrivateKey, Web3, Address};
use web3::transports::Http;

pub struct Provider {
    pub web3: Web3<Http>,
    pub account: Account,
    pub relayer_address: Address,
}

pub static mut provider: Option<Provider> = None;

#[get("/test")]
pub async fn test() -> String {
    unsafe {
        let web3 = provider.borrow().as_ref().unwrap();
        let chain_id = relayer::get_native_chain_id(
            &web3.web3,
            web3.relayer_address).await;
        format!("{}", chain_id)
    }
}

#[get("/adjust_perp")]
pub async fn adjust_perp() -> String {
    unsafe {
        let web3 = provider.borrow().as_ref().unwrap();
        let tx_data = perp_block::get_adjust_position_payload(&web3.web3, web3.relayer_address, 10000);
        relayer::send_action(&web3.web3, web3.relayer_address, tx_data);
        format!("Ok")
    }
}
