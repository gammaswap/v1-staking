// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

import "../RewardDistributor.sol";
import "../BonusDistributor.sol";

/**
 * @notice Proxy contract for `RewardDistributor` deployments
 */
contract RewardDistributorDeployer {
  function deploy(address _rewardToken, address _rewardTracker) external returns (address _distributor) {
    _distributor = address(new RewardDistributor(_rewardToken, _rewardTracker));
  }

  function deployBonusDistributor(address _rewardToken, address _rewardTracker) external returns (address _distributor) {
    _distributor = address(new BonusDistributor(_rewardToken, _rewardTracker));
  }
}