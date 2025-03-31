// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import "./RestrictedToken.sol";
import "../interfaces/IEsToken.sol";

contract EsToken is RestrictedToken, IEsToken {

    address public immutable override claimableToken;

    constructor(string memory _name, string memory _symbol, address _claimableToken) RestrictedToken(_name, _symbol,
        TokenType.ESCROW) {
        claimableToken = _claimableToken;
    }
}