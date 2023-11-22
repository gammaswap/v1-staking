// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/// @title Interface for Vester contract
/// @author Simon Mall
/// @notice Normal ERC20 token operations are not allowed
/// @dev Need to implement `supportsInterface` function
interface IVester is IERC165 {
    /// @dev Set handler for this contract
    /// @param _handler Address for query
    /// @param _isActive True - Enable, False - Disable
    function setHandler(address _handler, bool _isActive) external;

    /// @dev Returns reward tracker contract address
    function rewardTracker() external view returns (address);

    /// @dev Vest escrow tokens into GS
    /// @param _amount Amount of escrow tokens to vest
    function deposit(uint256 _amount) external;

    /// @dev Vest escrow tokens into GS on behalf of user
    /// @param _account User address for query
    /// @param _amount Amount of escrow tokens to vest
    function depositForAccount(address _account, uint256 _amount) external;

    /// @dev Claim GS rewards
    /// @return Amount of GS rewards
    function claim() external returns(uint256);

    /// @dev Claim GS rewards on behalf of user
    /// @param _account User address for query
    /// @param _receiver Receiver of rewards
    /// @return Amount of GS rewards
    function claimForAccount(address _account, address _receiver) external returns (uint256);

    /// @dev Withdraw escrow tokens and cancel vesting
    /// @dev Refund pair tokens to user
    function withdraw() external;

    /// @dev Withdraw escrow tokens and cancel vesting on behalf of user
    /// @dev Refund pair tokens to user
    /// @param _account User address for query
    function withdrawForAccount(address _account) external;

    /// @param _account User address for query
    /// @return Claimable GS amounts
    function claimable(address _account) external view returns (uint256);

    /// @param _account User address for query
    /// @return Cumulative amounts of GS rewards
    function cumulativeClaimAmounts(address _account) external view returns (uint256);

    /// @param _account User address for query
    /// @return Total claimed GS amounts
    function claimedAmounts(address _account) external view returns (uint256);

    /// @param _account User address for query
    /// @return Pair token amounts for account
    function pairAmounts(address _account) external view returns (uint256);

    /// @param _account User address for query
    /// @return Total vested escrow token amounts
    function getVestedAmount(address _account) external view returns (uint256);

    /// @param _account User address for query
    /// @return Cumulative reward deduction amounts
    function cumulativeRewardDeductions(address _account) external view returns (uint256);

    /// @param _account User address for query
    /// @return Bonus reward amounts
    function bonusRewards(address _account) external view returns (uint256);

    /// @dev Penalty user GS rewards
    /// @param _account User address for query
    /// @param _amount Deduction GS amounts to apply
    function setCumulativeRewardDeductions(address _account, uint256 _amount) external;

    /// @dev Add bonus GS rewards
    /// @param _account User address for query
    /// @param _amount Bonus GS amounts to apply
    function setBonusRewards(address _account, uint256 _amount) external;

    /// @param _account User address for query
    /// @return Max vestable escrow token amounts based on reward tracker, bonus and deductions
    function getMaxVestableAmount(address _account) external view returns (uint256);

    /// @param _account User address for query
    /// @return Average staked amount of pair tokens required for vesting
    function getAverageStakedAmount(address _account) external view returns (uint256);
}
