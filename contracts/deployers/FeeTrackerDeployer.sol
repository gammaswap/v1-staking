// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

import "../FeeTracker.sol";

/**
 * @notice Proxy contract for RewardTracker deployments
 */
contract FeeTrackerDeployer {
  function deploy(uint256 _bnRateCap) external returns (address _feeTracker) {
    _feeTracker = address(new FeeTracker(_bnRateCap));
  }
}