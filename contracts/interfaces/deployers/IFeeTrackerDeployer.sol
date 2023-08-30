// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0;

interface IFeeTrackerDeployer {
  function deploy(uint256 _bnRateCap) external returns (address _feeTracker);
}