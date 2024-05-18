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

  /// @dev Thrown when creating staking contracts that have already been created for that deposit token
  error StakingContractsAlreadySet();

  /// @dev Thrown when a initializing the StakingAdmin with a zero address
  error MissingBeaconProxyFactory();

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

  /// @dev Initialize StakingAdmin contract
  /// @param _loanTrackerFactory address of BeaconProxyFactory with LoanTracker implementation
  /// @param _rewardTrackerFactory address of BeaconProxyFactory with RewardTracker implementation
  /// @param _feeTrackerFactory address of BeaconProxyFactory with FeeTracker implementation
  /// @param _rewardDistributorFactory address of BeaconProxyFactory with RewardDistributor implementation
  /// @param _bonusDistributorFactory address of BeaconProxyFactory with BonusDistributor implementation
  /// @param _vesterFactory address of BeaconProxyFactory with Vester implementation
  /// @param _vesterNoReserveFactory address of BeaconProxyFactory with VesterNoReserve implementation
  function initialize(address _loanTrackerFactory, address _rewardTrackerFactory, address _feeTrackerFactory,
    address _rewardDistributorFactory, address _bonusDistributorFactory, address _vesterFactory,
    address _vesterNoReserveFactory) external;

  /// @dev Set vesting period for staking contract reward token
  function setPoolVestingPeriod(uint256 _poolVestingPeriod) external;

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
