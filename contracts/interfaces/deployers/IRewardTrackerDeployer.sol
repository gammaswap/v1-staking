// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

/// @title Interface for RewardTrackerDeployer contract
/// @author Simon Mall
/// @notice Deploy reward tracker contracts from StakingAdmin
interface IRewardTrackerDeployer {
  /// @dev Deploy RewardTracker contract
  /// @param _name RewardTracker name
  /// @param _symbol RewardTracker symbol
  function deploy(string memory _name, string memory _symbol) external returns (address _rewardTracker);

  /// @dev Deploy LoanTracker contract
  /// @param _factory GammaPoolFactory address
  /// @param _refId LoanObserver Id
  /// @param _manager PositionManager address
  /// @param _name LoanTracker name
  /// @param _symbol LoanTracker symbol
  function deployLoanTracker(
    address _factory,
    uint16 _refId,
    address _manager,
    string memory _name,
    string memory _symbol
  ) external returns (address _loanTracker);
}
