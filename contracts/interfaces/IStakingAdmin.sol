// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

/// @title Interface for StakingAdmin contract
/// @author Simon Mall
/// @notice StakingAdmin is an abstract base contract for StakingRouter
/// @notice StakingAdmin is meant to have admin only functions
interface IStakingAdmin {
  /// @dev Thrown in constructor for invalid params
  error InvalidConstructor();

  /// @dev Thrown in constructor for invalid restricted tokens
  error InvalidRestrictedToken();

  /// @dev Thrown in `execute` when calling untrusted contracts
  error InvalidExecute();

  /// @dev Thrown in `execute` for executing arbitrary calls for staking contracts
  error ExecuteFailed();

  /// @dev Contracts for global staking
  struct AssetCoreTracker {
    address rewardTracker;  // Track GS + esGS
    address rewardDistributor;  // Reward esGS
    address loanRewardTracker;  // Track esGSb
    address loanRewardDistributor;  // Reward esGSb
    address bonusTracker; // Track GS + esGS + esGSb
    address bonusDistributor; // Reward bnGS
    address feeTracker; // Track GS + esGS + esGSb + bnGS(aka MP)
    address feeDistributor; // Reward WETH
    address vester; // Vest esGS -> GS (reserve GS or esGS or bnGS)
    address loanVester; // Vest esGSb -> GS (without reserved tokens)
  }

  /// @dev Contracts for pool-level staking
  struct AssetPoolTracker {
    address rewardTracker;  // Track GS_LP
    address rewardDistributor;  // Reward esGS
    address loanRewardTracker;  // Track tokenId(loan)
    address loanRewardDistributor;  // Reward esGSb
    address vester; // Vest esGS -> GS (reserve GS_LP)
  }

  /// @dev Setup global staking for GS/esGS/bnGS
  function setupGsStaking() external;

  /// @dev Setup global staking for esGSb
  function setupGsStakingForLoan() external;

  /// @dev Setup pool-level staking for GS_LP
  /// @param _gsPool GammaPool address
  /// @param _esToken Escrow reward token
  /// @param _claimableToken Claimable token from vesting
  function setupPoolStaking(address _gsPool, address _esToken, address _claimableToken) external;

  /// @dev Setup pool-level staking for loans
  /// @param _gsPool GammaPool address
  /// @param _refId Reference id for loan observer
  function setupPoolStakingForLoan(address _gsPool, uint16 _refId) external;

  /// @dev Execute arbitrary calls for staking contracts
  /// @param _stakingContract Contract to execute on
  /// @param _data Bytes data to pass as param
  function execute(address _stakingContract, bytes memory _data) external;

  /// @dev Emitted in `setupGsStaking`
  event CoreTrackerCreated(address rewardTracker, address rewardDistributor, address bonusTracker, address bonusDistributor, address feeTracker, address feeDistributor, address vester);

  /// @dev Emitted in `setupGsStakingForLoan`
  event CoreTrackerUpdated(address loanRewardTracker, address loanRewardDistributor, address loanVester);

  /// @dev Emitted in `setupPoolStaking`
  event PoolTrackerCreated(address indexed gsPool, address rewardTracker, address rewardDistributor, address vester);

  /// @dev Emitted in `setupPoolStakingForLoan`
  event PoolTrackerUpdated(address indexed gsPool, address loanRewardtracker, address loanRewardDistributor);
}
