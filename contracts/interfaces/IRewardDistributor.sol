// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/// @title RewardDistributor contract
/// @author Simon Mall (small@gammaswap.com)
/// @notice Distribute reward tokens to reward trackers
/// @dev Need to implement `supportsInterface` function
interface IRewardDistributor is IERC165 {
    /// @dev Given in the constructor
    /// @return Reward token contract
    function rewardToken() external view returns (address);

    /// @dev Amount of tokens to be distributed every second
    /// @return The tokens per interval based on duration
    function tokensPerInterval() external view returns (uint256);

    /// @dev Calculates the pending rewards based on the time since the last distribution
    /// @return The pending rewards amount
    function pendingRewards() external view returns (uint256);

    /// @dev Distributes pending rewards to the reward tracker
    /// @return The amount of rewards distributed
    function distribute() external returns (uint256);

    /// @dev Updates the last distribution time to the current block timestamp
    /// @dev Can only be called by the contract owner.
    function updateLastDistributionTime() external;

    /// @dev Emitted when rewards are distributed to reward tracker
    /// @param amount Amount of reward tokens distributed
    event Distribute(uint256 amount);

    /// @dev Emitted when `tokensPerInterval` is updated
    /// @param amount Amount of reward tokens for every second
    event TokensPerIntervalChange(uint256 amount);

    /// @dev Emitted when bonus multipler basispoint is updated
    /// @param basisPoints New basispoints for bonus multiplier
    event BonusMultiplierChange(uint256 basisPoints);
}
