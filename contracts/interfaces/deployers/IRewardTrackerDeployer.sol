// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

interface IRewardTrackerDeployer {
  function deploy(string memory _name, string memory _symbol) external returns (address _rewardTracker);

  function deployLoanTracker(
    address _factory,
    uint16 _refId,
    address _manager,
    string memory _name,
    string memory _symbol
  ) external returns (address _loanTracker);
}