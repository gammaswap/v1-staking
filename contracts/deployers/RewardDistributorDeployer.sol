// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import "../RewardDistributor.sol";
import "../BonusDistributor.sol";
import "../interfaces/deployers/IRewardDistributorDeployer.sol";

/**
 * @notice Proxy contract for `RewardDistributor` deployments
 */
contract RewardDistributorDeployer is IRewardDistributorDeployer {
  /// @inheritdoc IRewardDistributorDeployer
    function deploy(address _rewardToken, address _rewardTracker) external returns (address _distributor) {
        _distributor = address(new RewardDistributor(_rewardToken, _rewardTracker));
    }

    /// @inheritdoc IRewardDistributorDeployer
    function deployBonusDistributor(address _rewardToken, address _rewardTracker) external returns (address _distributor) {
        _distributor = address(new BonusDistributor(_rewardToken, _rewardTracker));
    }
}