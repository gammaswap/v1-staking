// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

interface IRewardDistributor {
    function rewardToken() external view returns (address);
    function tokensPerInterval() external view returns (uint256);
    function pendingRewards() external view returns (uint256);
    function distribute() external returns (uint256);
    function updateLastDistributionTime() external;

    event Distribute(uint256);
    event TokensPerIntervalChange(uint256);
    event BonusMultiplierChange(uint256);
}
