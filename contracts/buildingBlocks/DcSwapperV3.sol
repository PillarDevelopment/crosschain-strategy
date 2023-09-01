// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "./BaseBuildingBlock.sol";
import "../interfaces/buildingBlocks/IDcSwapperV3.sol";

/**
 * @author DeCommas team
 * @title DcSwapper V3 - uniswap v3 integration
 */
contract DcSwapperV3 is BaseBuildingBlock, IDcSwapperV3 {
    IV3SwapRouter public amm;
    IUniswapV3Factory public factory;
    address public wrappedNativeToken;
    uint24[] public fees;

    function initialize(bytes memory _data) public initializer {
        (
            address routerAddress,
            address usdcToken,
            address wrappedNativeTokenAddress,
            address uniFactory,
            uint24[] memory feeLevels,
            uint16 nativeId,
            address relayerAddress,
            address nativeDcRouterAddress
        ) = abi.decode(
                _data,
                (
                    address,
                    address,
                    address,
                    address,
                    uint24[],
                    uint16,
                    address,
                    address
                )
            );
        require(
            routerAddress != address(0x0),
            "DcSwapperV3::initialize: routerAddress zero address"
        );
        require(
            usdcToken != address(0x0),
            "DcSwapperV3::initialize: usdcToken zero address"
        );
        require(
            wrappedNativeTokenAddress != address(0x0),
            "DcSwapperV3::initialize: wrappedNativeToken zero address"
        );
        require(
            uniFactory != address(0x0),
            "DcSwapperV3::initialize: uniFactory zero address"
        );
        require(
            feeLevels.length > 0,
            "DcSwapperV3::initialize: invalid uniswap fee levels"
        );
        require(nativeId > 0, "DcSwapperV3::initialize: nativeId zero id");
        require(
            relayerAddress != address(0x0),
            "DcSwapperV3::initialize: relayer zero address"
        );
        require(
            nativeDcRouterAddress != address(0x0),
            "DcSwapperV3::initialize: nativeDcRouterAddress zero address"
        );
        __Ownable_init();
        _transferOwnership(_msgSender());

        amm = IV3SwapRouter(routerAddress);
        currentUSDCToken = usdcToken;
        wrappedNativeToken = wrappedNativeTokenAddress;
        factory = IUniswapV3Factory(uniFactory);
        nativeChainId = nativeId;
        nativeRouter = nativeDcRouterAddress;
        deCommasRelayerAddress = relayerAddress;

        IERC20(wrappedNativeToken).approve(address(amm), type(uint256).max);
        fees = feeLevels;
    }

    /**
     * @notice set dex addresses
     * @param newFactory dexFactory address and dexRouter address
     * @dev only relayer
     */
    function setDex(address newFactory, address newAmm)
        public
        override
        onlyRelayer
    {
        amm = IV3SwapRouter(newAmm);
        factory = IUniswapV3Factory(newFactory);
        IERC20(wrappedNativeToken).approve(newAmm, type(uint256).max);
        emit DexUpgraded(newFactory, newAmm);
    }

    /**
     * @notice set fee levels for pool
     * @param newFees fee array
     * @dev only relayer
     */
    function setFeesLevels(uint24[] memory newFees)
        public
        override
        onlyRelayer
    {
        require(
            newFees.length > 0,
            "DcSwapperV3::setFeesLevels: invalid uniswap fee levels"
        );
        fees = newFees;
    }

    /**
     * @notice Swap exact input
     * @param tokenA tokenA, tokenB, amount, recipient params for swap
     * @dev only relayer
     */
    function swap(
        address tokenA,
        address tokenB,
        uint256 amount,
        address recipient
    ) public payable override onlyRelayer returns (uint256) {
        address swapTokenA = tokenA;
        address swapTokenB = tokenB;
        address swapRecipient = recipient;
        if (tokenA != address(0x0)) {
            require(
                IERC20(tokenA).balanceOf(address(this)) >= amount,
                "DcSwapperV3::swap: deposit or bridge swap amountIn"
            );
            IERC20(tokenA).approve(address(amm), amount);
        } else {
            require(msg.value == amount, "DcSwapperV3::swap: amount mismatch");
            swapTokenA = wrappedNativeToken;
            IWrappedNativeToken(wrappedNativeToken).deposit{value: msg.value}();
        }
        if (tokenB == address(0x0)) {
            swapTokenB = wrappedNativeToken;
            swapRecipient = address(this);
        }

        (, uint24 fee, , ) = getBestFee(swapTokenA, swapTokenB);
        require(fee != 0, "DcSwapperV3::swap: no pool");

        IV3SwapRouter.ExactInputSingleParams memory params = IV3SwapRouter
            .ExactInputSingleParams({
                tokenIn: swapTokenA,
                tokenOut: swapTokenB,
                fee: fee,
                recipient: swapRecipient,
                amountIn: amount,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            });
        uint256 output = amm.exactInputSingle(params);

        if (tokenB == address(0x0)) {
            IWrappedNativeToken(wrappedNativeToken).withdraw(output);
            if (!payable(recipient).send(output)) {
                IERC20(wrappedNativeToken).transfer(recipient, output);
            }
        }

        emit Swapped(swapTokenA, swapTokenB, swapRecipient, amount);
        return output;
    }

    /**
     * @notice returns swap status for tokens
     * @param bridgeToken sgBridge token address
     * @param tokens array of tokens
     * @return bool
     */
    function isTokensSupported(address bridgeToken, address[] memory tokens)
        public
        view
        override
        returns (bool[] memory)
    {
        bool[] memory results = new bool[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            results[i] = isTokenSupported(bridgeToken, tokens[i]);
        }
        return results;
    }

    /**
     * @notice returns swap status for tokens
     * @param tokens array of token's pairs
     * @return bool
     */
    function isPairsSupported(address[][] calldata tokens)
        public
        view
        override
        returns (bool[] memory)
    {
        bool[] memory results = new bool[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            (address pool, , , ) = getBestFee(tokens[i][0], tokens[i][1]);
            results[i] = pool != address(0);
        }
        return results;
    }

    /**
     * @notice returns best fee for pair
     * @param tokenA first token in pair
     * @param tokenB second token in pair
     * @return pool, fee, tokenA, tokenB
     */
    function getBestFee(address tokenA, address tokenB)
        public
        view
        override
        returns (
            address,
            uint24,
            address,
            address
        )
    {
        if (tokenA == tokenB) {
            return (tokenA, 0, tokenA, tokenB);
        }
        address swapTokenA = tokenA;
        address swapTokenB = tokenB;
        if (tokenA == address(0x0)) {
            swapTokenA = wrappedNativeToken;
        }
        if (tokenB == address(0x0)) {
            swapTokenB = wrappedNativeToken;
        }
        for (uint256 i = 0; i < fees.length; i++) {
            address pool = factory.getPool(swapTokenA, swapTokenB, fees[i]);
            if (pool != address(0)) {
                return (pool, fees[i], swapTokenA, swapTokenB);
            }
        }
        return (address(0x0), 0, swapTokenA, swapTokenB);
    }

    function isTokenSupported(address bridgeToken, address token)
        public
        view
        override
        returns (bool)
    {
        if (bridgeToken == token) {
            return true;
        } else {
            (address pool, , , ) = getBestFee(bridgeToken, token);
            return pool != address(0);
        }
    }
}
