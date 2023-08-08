// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "./RestrictedToken.sol";

contract GS is RestrictedToken {
  constructor() RestrictedToken("GammaSwap", "GS") {}

  function setHandler(address, bool) public override pure {
    revert("GS: Forbidden");
  }
}