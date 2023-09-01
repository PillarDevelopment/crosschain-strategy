mod api;

#[macro_use]
extern crate rocket;

use serde::{Deserialize, Serialize};
use web3::transports::Http;

use std::collections::HashMap;
use std::env;
use std::io::prelude::*;
use std::net::TcpListener;
use std::net::TcpStream;

use dotenv::dotenv;
use ethcontract::{Account, PrivateKey, Web3};
use ethcontract::errors::EventError;
use ethcontract::futures::{join, StreamExt};
use ethcontract::prelude::*;

use rocket::{Build, Rocket};

fn web3_config() -> (Web3<Http>, Account) {
    let node_url = std::env::var("WEB3_NODE").ok()
        .expect("No WEB3_NODE set");
    let key: PrivateKey = std::env::var("PRIVATE_KEY")
        .expect("No PRIVATE_KEY set")
        .parse()
        .expect("No PRIVATE_KEY set");
    let transport = Http::new(&node_url).expect("Failed to create HTTP transport");
    let web3 = Web3::new(transport);
    let account = Account::Offline(key, None);
    (web3, account)
}

#[tokio::main]
async fn main() {
    dotenv().ok();
    let (web3, account) = web3_config();
    let provider = api::Provider{
        web3,
        account,
        relayer_address: " ".parse().unwrap()
    };
    unsafe {
        api::provider = Some(provider);
    }
    let builder = rocket::build().mount("/",
                                        routes![
                                            api::test,
                                            api::adjust,
                                        ]);
    let _ = builder.launch().await.expect("ROCKET PANIC");
}
