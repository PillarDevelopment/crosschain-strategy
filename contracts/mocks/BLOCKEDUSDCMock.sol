// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract BLOCKEDUSDCMock is ERC20 {
    mapping(address => bool) private _blacklist;

    constructor() ERC20("USDC", "USDC") {}

    function mint(address _to, uint256 _amount) external returns (bool) {
        _mint(_to, _amount);
        return true;
    }

    function burn(uint256 _amount) external returns (bool) {
        _burn(msg.sender, _amount);
        return true;
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function addToBlackList(address _member) external {
        _blacklist[_member] = true;
    }

    function transfer(address to, uint256 amount)
        public
        override
        returns (bool)
    {
        require(!_blacklist[_msgSender()]);
        address owner = _msgSender();
        _transfer(owner, to, amount);
        return false;
    }

    function transferFrom(
        address,
        address,
        uint256
    ) public pure override returns (bool) {
        return false;
    }
}
