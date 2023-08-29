// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

interface IRewardDistributorDeployer {
  function deploy(address _rewardToken, address _rewardTracker) external returns (address _distributor);

  function deployBonusDistributor(address _rewardToken, address _rewardTracker) external returns (address _distributor);
}