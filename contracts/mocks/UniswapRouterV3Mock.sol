// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

interface IUniswapV3SwapCallback {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
}

interface ITOKEN {
    function mint(address _to, uint256 _amount) external returns (bool);
}

contract UniswapRouterV3Mock is IUniswapV3SwapCallback {
    constructor() {}

    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        returns (uint256)
    {
        ITOKEN(params.tokenOut).mint(params.recipient, params.amountIn);
        return params.amountIn;
    }
}
