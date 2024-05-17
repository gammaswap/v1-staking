// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

/// @title Interface for VesterDeployer contract
/// @author Simon Mall
/// @notice Deploy vester contracts from StakingAdmin
interface IVesterDeployer {
  /// @dev Deploy Vester contract
  /// @param _name Vester name
  /// @param _symbol Vester symbol
  /// @param _vestingDuration Vesting duration (1 year)
  /// @param _esToken esGS token address
  /// @param _pairToken Pair token address
  /// @param _claimableToken GS token address
  /// @param _rewardTracker RewardTracker address
  function deploy(
    string memory _name,
    string memory _symbol,
    uint256 _vestingDuration,
    address _esToken,
    address _pairToken,
    address _claimableToken,
    address _rewardTracker
  ) external returns (address _vester);

  /// @dev Deploy VesternoReserve contract
  /// @param _name VesternoReserve name
  /// @param _symbol VesternoReserve symbol
  /// @param _vestingDuration Vesting duration (1 year)
  /// @param _esToken esGSb token address
  /// @param _claimableToken GS token address
  /// @param _rewardTracker LoanTracker address
  function deployVesterNoReserve(
    string memory _name,
    string memory _symbol,
    uint256 _vestingDuration,
    address _esToken,
    address _claimableToken,
    address _rewardTracker
  ) external returns (address _vester);
}
