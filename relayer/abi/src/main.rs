use ethcontract_generate::loaders::TruffleLoader;
use ethcontract_generate::ContractBuilder;

fn generate(path: &str, name: &str) {
    let out_dir = "../src/gen";
    let path = format!("../../artifacts/contracts/{}/{}.sol/", path, name);
    let dest = std::path::Path::new(&out_dir).join(format!("{}.rs", name));

    // Load a contract.
    let contract = TruffleLoader::new()
        .load_contract_from_file(format!("{}/{}.json", path, name))
        .unwrap();

    // Generate bindings for it.
    ContractBuilder::new()
        .generate(&contract)
        .unwrap()
        .write_to_file(dest)
        .unwrap();
}

fn main() {
    generate("buildingBlocks","BaseBuildingBlock");
    generate("buildingBlocks","UniswapVault");
    generate("buildingBlocks","DcPerpetualVault");
}
