// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

interface IRewardDistributor is IERC165 {
    function rewardToken() external view returns (address);
    function tokensPerInterval() external view returns (uint256);
    function pendingRewards() external view returns (uint256);
    function distribute() external returns (uint256);
    function updateLastDistributionTime() external;

    event Distribute(uint256);
    event TokensPerIntervalChange(uint256);
    event BonusMultiplierChange(uint256);
}
