// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "../RewardTracker.sol";

/**
 * @notice Proxy contract for `RewardTracker` deployments
 */
contract RewardTrackerDeployer {
  function deploy(string memory _name, string memory _symbol) external returns (address _rewardTracker) {
    _rewardTracker = address(new RewardTracker(_name, _symbol));
  }
}