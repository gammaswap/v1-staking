// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

/// @title Interface for FeeTrackerDeployer contract
/// @author Simon Mall
/// @notice Deploy FeeTracker contract from StakingAdmin
interface IFeeTrackerDeployer {
  /// @dev Deploy FeeTracker
  /// @param _bnRateCap Bonus utilization rate
  function deploy(uint256 _bnRateCap) external returns (address _feeTracker);
}
