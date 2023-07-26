// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

interface IStakingAdmin {
  error InvalidConstructor();
  error InvalidExecute();
  error ExecuteFailed();

  struct AssetCoreTracker {
    address rewardTracker;  // Track GS + esGSL
    address rewardDistributor;  // Reward esGSL
    address loanRewardTracker;  // Track esGSB
    address loanRewardDistributor;  // Reward esGSB
    address bonusTracker; // Track GS + esGSL + esGSB
    address bonusDistributor; // Reward bnGS
    address feeTracker; // Track GS + esGSL + esGSB + bnGS(aka MP)
    address feeDistributor; // Reward WETH
    address vester; // Vest esGSL -> GS (reserve GS_LP or GS)
    address loanVester; // Vest esGSB -> GS (without reserved tokens)
  }

  struct AssetPoolTracker {
    address rewardTracker;  // Track GS_LP
    address rewardDistributor;  // Reward esGSL
    address loanRewardTracker;  // Track tokenId(loan)
    address loanRewardDistributor;  // Reward esGSB
    address vester; // Vest esGSL -> GS (reserve GS_LP)
    address loanVester; // Vest esGSB -> GS (without reserved tokens)
  }

  function setupGsStaking() external;
  function setupLpStaking(address) external;
  function execute(address, bytes memory) external;
}
