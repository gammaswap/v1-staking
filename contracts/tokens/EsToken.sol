//SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import "./RestrictedToken.sol";

contract EsToken is RestrictedToken {
    constructor(string memory _name, string memory _symbol) RestrictedToken(_name, _symbol, TokenType.ESCROW) {}
}