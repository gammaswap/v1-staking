// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

import "./RestrictedToken.sol";

contract GS is RestrictedToken {
  constructor() RestrictedToken("GammaSwap", "GS") {}

  function setHandler(address, bool) public override pure {
    revert("GS: Forbidden");
  }

  function transfer(address to, uint256 amount) public override returns (bool) {
    address user = msg.sender;
    _transfer(user, to, amount);
    return true;
  }

  function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
    address spender = msg.sender;
    _spendAllowance(from, spender, amount);
    _transfer(from, to, amount);
    return true;
  }
}