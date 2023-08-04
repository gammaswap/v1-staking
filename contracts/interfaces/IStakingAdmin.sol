// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

interface IStakingAdmin {
  error InvalidConstructor();
  error InvalidExecute();
  error ExecuteFailed();

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

  struct AssetPoolTracker {
    address rewardTracker;  // Track GS_LP
    address rewardDistributor;  // Reward esGS
    address loanRewardTracker;  // Track tokenId(loan)
    address loanRewardDistributor;  // Reward esGSb
    address vester; // Vest esGS -> GS (reserve GS_LP)
  }

  function setupGsStaking() external;
  function setupLpStaking(address, uint16) external;
  function execute(address, bytes memory) external;
}
