// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/// @title Interface for RewardTracker contract
/// @author Simon Mall
/// @notice Track staked/unstaked tokens along with their rewards
/// @notice RewardTrackers are ERC20
/// @dev Need to implement `supportsInterface` function
interface IRewardTracker is IERC165 {
    /// @dev Configure contract after deployment
    /// @param _depositTokens Eligible tokens for stake
    /// @param _distributor Reward distributor
    function initialize(address[] memory _depositTokens, address _distributor) external;

    /// @dev Set/Unset staking for token
    /// @param _depositToken Token address for query
    /// @param _isDepositToken True - Set, False - Unset
    function setDepositToken(address _depositToken, bool _isDepositToken) external;

    /// @dev Enable/Disable token transfers between accounts
    /// @param _inPrivateTransferMode Whether or not to enable token transfers
    function setInPrivateTransferMode(bool _inPrivateTransferMode) external;

    /// @dev Enable/Disable token staking from individual users
    /// @param _inPrivateStakingMode Whether or not to enable token staking
    function setInPrivateStakingMode(bool _inPrivateStakingMode) external;

    /// @dev Enable/Disable rewards claiming from individual users
    /// @param _inPrivateClaimingMode Whether or not to enable rewards claiming
    function setInPrivateClaimingMode(bool _inPrivateClaimingMode) external;

    /// @dev Set handler for this contract
    /// @param _handler Address for query
    /// @param _isActive True - Enable, False - Disable
    function setHandler(address _handler, bool _isActive) external;

    /// @param _account Address for query
    /// @param _depositToken Token address for query
    /// @return Amount of staked tokens for user
    function depositBalances(address _account, address _depositToken) external view returns (uint256);

    /// @param _account Address for query
    /// @return Total staked amounts for all deposit tokens
    function stakedAmounts(address _account) external view returns (uint256);

    /// @dev Update reward params for contract
    function updateRewards() external;

    /// @dev Stake deposit token to this contract
    /// @param _depositToken Deposit token to stake
    /// @param _amount Amount of deposit tokens
    function stake(address _depositToken, uint256 _amount) external;

    /// @dev Stake tokens on behalf of user
    /// @param _fundingAccount Address to stake tokens from
    /// @param _account Address to stake tokens for
    /// @param _depositToken Deposit token to stake
    /// @param _amount Amount of deposit tokens
    function stakeForAccount(address _fundingAccount, address _account, address _depositToken, uint256 _amount) external;

    /// @dev Unstake tokens from this contract
    /// @param _depositToken Deposited token
    /// @param _amount Amount to unstake
    function unstake(address _depositToken, uint256 _amount) external;

    /// @dev Unstake tokens on behalf of user
    /// @param _account Address to unstake tokens from
    /// @param _depositToken Deposited token
    /// @param _amount Amount to unstake
    /// @param _receiver Receiver of unstaked tokens
    function unstakeForAccount(address _account, address _depositToken, uint256 _amount, address _receiver) external;

    /// @return Reward tokens emission per second
    function tokensPerInterval() external view returns (uint256);

    /// @dev Claim rewards for user
    /// @param _receiver Receiver of the rewards
    function claim(address _receiver) external returns (uint256);

    /// @dev Claim rewards on behalf of user
    /// @param _account User address eligible for rewards
    /// @param _receiver Receiver of the rewards
    function claimForAccount(address _account, address _receiver) external returns (uint256);

    /// @dev Returns claimable rewards amount for the user
    /// @param _account User address for this query
    function claimable(address _account) external view returns (uint256);

    /// @param _account Address for query
    /// @return Average staked amounts of pair tokens required (used for vesting)
    function averageStakedAmounts(address _account) external view returns (uint256);

    /// @param _account User account in query
    /// @return Accrued rewards for user
    function cumulativeRewards(address _account) external view returns (uint256);

    /// @dev Emitted when rewards are claimed
    /// @param _account Beneficiary user
    /// @param _amount Rewards amount claimed
    event Claim(address _account, uint256 _amount);
}
