// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

interface IStakingAdmin {
  error InvalidConstructor();
  error InvalidExecute();
  error ExecuteFailed();

  struct AssetCoreTracker {
    address rewardTracker;  // Track GS + esGSlp
    address rewardDistributor;  // Reward esGSlp
    address loanRewardTracker;  // Track esGSb
    address loanRewardDistributor;  // Reward esGSb
    address bonusTracker; // Track GS + esGSL + esGSb
    address bonusDistributor; // Reward bnGS
    address feeTracker; // Track GS + esGSlp + esGSb + bnGS(aka MP)
    address feeDistributor; // Reward WETH
    address vester; // Vest esGSlp -> GS (reserve GS or esGSlp or bnGS)
    address loanVester; // Vest esGSb -> GS (without reserved tokens)
  }

  struct AssetPoolTracker {
    address rewardTracker;  // Track GS_LP
    address rewardDistributor;  // Reward esGSlp
    address loanRewardTracker;  // Track tokenId(loan)
    address loanRewardDistributor;  // Reward esGSb
    address vester; // Vest esGSlp -> GS (reserve GS_LP)
  }

  function setupGsStaking() external;
  function setupLpStaking(address, uint16) external;
  function execute(address, bytes memory) external;
}
