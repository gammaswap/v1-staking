// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

interface IRestrictedToken {
  function isManager(address) external returns (bool);
  function setManager(address, bool) external;
  function isHandler(address) external returns (bool);
  function setHandler(address, bool) external;
  function mint(address, uint256) external;
  function burn(address, uint256) external;
}