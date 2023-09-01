// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

contract UniswapV3Pool {
    address public token0;
    address public token1;
    uint24 public fee;

    constructor(
        address _token0,
        address _token1,
        uint24 _fee
    ) {
        token0 = _token0;
        token1 = _token1;
        fee = _fee;
    }
}

contract UniswapFactoryV3Mock {
    constructor() {}

    mapping(address => mapping(address => mapping(uint24 => address)))
        public getPool;

    function createPool(
        address tokenA,
        address tokenB,
        uint24 fee
    ) external returns (address pool) {
        require(tokenA != tokenB);
        (address token0, address token1) = tokenA < tokenB
            ? (tokenA, tokenB)
            : (tokenB, tokenA);
        pool = deploy(address(this), token0, token1, fee);
        getPool[token0][token1][fee] = pool;
        getPool[token1][token0][fee] = pool;
    }

    function deploy(
        address,
        address token0,
        address token1,
        uint24 fee
    ) internal returns (address pool) {
        pool = address(new UniswapV3Pool(token0, token1, fee));
    }

    function enableFeeAmount(uint24 fee, int24 tickSpacing) public {}
}
