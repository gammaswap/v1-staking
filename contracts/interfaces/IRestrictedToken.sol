// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

interface IRestrictedToken {
  function setHandler(address, bool) external;
  function mint(address, uint256) external;
  function burn(address, uint256) external;
}