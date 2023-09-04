// SPDX-License-Identifier: MIT

pragma solidity 0.8.19;

import "../FeeTracker.sol";
import "../interfaces/deployers/IFeeTrackerDeployer.sol";

/**
 * @notice Proxy contract for RewardTracker deployments
 */
contract FeeTrackerDeployer is IFeeTrackerDeployer {
  function deploy(uint256 _bnRateCap) external returns (address _feeTracker) {
    _feeTracker = address(new FeeTracker(_bnRateCap));
  }
}