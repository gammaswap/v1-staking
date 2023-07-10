// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "./IRewardDistributor.sol";
import "./IRewardTracker.sol";
import "./IVester.sol";

interface IStakingAdmin {
  function rewardTracker() external view returns (IRewardTracker);
  function rewardDistributor() external view returns (IRewardDistributor);
  function bonusTracker() external view returns (IRewardTracker);
  function bonusDistributor() external view returns (IRewardDistributor);
  function feeRewardTracker() external view returns (IRewardTracker);
  function feeRewardDistributor() external view returns (IRewardDistributor);
  function vester() external view returns (IVester);

  function setupGsStaking() external;
  function setupLpStaking(address) external;
}
