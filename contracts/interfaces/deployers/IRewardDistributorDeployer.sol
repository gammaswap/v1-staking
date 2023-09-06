// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0;

/// @title Interface for RewardDistributorDeployer contract
/// @author Simon Mall (small@gammaswap.com)
/// @notice Deploy reward distributor contracts from StakingAdmin
interface IRewardDistributorDeployer {
  /// @dev Deploy RewardDistrubutor contract
  /// @param _rewardToken Reward token address
  /// @param _rewardTracker Reward tracker address
  function deploy(address _rewardToken, address _rewardTracker) external returns (address _distributor);

  /// @dev Deploy BonusDistributor contract
  /// @param _rewardToken Reward token address
  /// @param _rewardTracker Reward tracker address
  function deployBonusDistributor(address _rewardToken, address _rewardTracker) external returns (address _distributor);
}
