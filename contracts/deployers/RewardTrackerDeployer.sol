// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

import "../RewardTracker.sol";
import "../LoanTracker.sol";

/**
 * @notice Proxy contract for RewardTracker deployments
 */
contract RewardTrackerDeployer {
  function deploy(string memory _name, string memory _symbol) external returns (address _rewardTracker) {
    _rewardTracker = address(new RewardTracker(_name, _symbol));
  }

  function deployLoanTracker(
    address _factory,
    uint16 _refId,
    address _manager,
    string memory _name,
    string memory _symbol
  ) external returns (address _loanTracker) {
    _loanTracker = address(new LoanTracker(_factory, _refId, _manager, _name, _symbol));
  }
}