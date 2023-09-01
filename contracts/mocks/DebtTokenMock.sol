// SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

contract DebtTokenMock {
    function approveDelegation(address, uint256) public pure returns (bool) {
        return true;
    }
}
