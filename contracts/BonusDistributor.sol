// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

import "./interfaces/IRewardDistributor.sol";
import "./interfaces/IRewardTracker.sol";

/// @title BonusDistributor Contract
/// @author Simon Mall (small@gammaswap.com)
/// @notice Multiplier Points reward contract for protocol revenue share
/// @dev Rewards(bnGs) are distributed linearly for a year
contract BonusDistributor is Ownable2Step, IRewardDistributor {
    using SafeERC20 for IERC20;

    /// @notice Max basis points for distribution
    /// @notice 10000 -> 100%
    uint256 public constant BASIS_POINTS_DIVISOR = 10000;
    uint256 public constant BONUS_DURATION = 365 days;

    /// @notice Basis points for distribution
    /// @notice Limited to `BASIS_POINTS_DIVISOR`
    uint256 public bonusMultiplierBasisPoints;

    /// @notice Reward Token - bnGs
    address public override rewardToken;
    uint256 public lastDistributionTime;
    address public rewardTracker;
    bool public paused;

    /// @dev Constructor function
    /// @param _rewardToken Address of the ERC20 token used for rewards
    /// @param _rewardTracker Address of the reward tracker contract
    constructor(address _rewardToken, address _rewardTracker) {
        rewardToken = _rewardToken;
        rewardTracker = _rewardTracker;
    }

    /// @inheritdoc IRewardDistributor
    function updateLastDistributionTime() external onlyOwner {
        lastDistributionTime = block.timestamp;
    }

    /// @notice Set basis points
    function setBonusMultiplier(uint256 _bonusMultiplierBasisPoints) external onlyOwner {
        require(lastDistributionTime != 0, "BonusDistributor: invalid lastDistributionTime");

        IRewardTracker(rewardTracker).updateRewards();
        bonusMultiplierBasisPoints = _bonusMultiplierBasisPoints;

        emit BonusMultiplierChange(_bonusMultiplierBasisPoints);
    }

    /// @inheritdoc IRewardDistributor
    function setPaused(bool _paused) external onlyOwner {
        if (_paused) {
            IRewardTracker(rewardTracker).updateRewards();
        } else {
            lastDistributionTime = block.timestamp;
        }

        paused = _paused;

        emit StatusChange(rewardTracker, block.timestamp, _paused);
    }

    /// @inheritdoc IRewardDistributor
    function tokensPerInterval() public view override returns (uint256) {
        uint256 supply = IERC20(rewardTracker).totalSupply();
        return supply * bonusMultiplierBasisPoints / (BASIS_POINTS_DIVISOR * BONUS_DURATION);
    }

    /// @inheritdoc IRewardDistributor
    function pendingRewards() public view override returns (uint256) {
        if (paused || block.timestamp == lastDistributionTime) {
            return 0;
        }

        uint256 timeDiff = block.timestamp - lastDistributionTime;

        return timeDiff * tokensPerInterval();
    }

    /// @inheritdoc IRewardDistributor
    function distribute() external override returns (uint256) {
        address caller = msg.sender;
        require(caller == rewardTracker, "BonusDistributor: invalid msg.sender");
        uint256 amount = pendingRewards();
        if (amount == 0) { return 0; }

        lastDistributionTime = block.timestamp;

        uint256 balance = IERC20(rewardToken).balanceOf(address(this));
        if (amount > balance) { amount = balance; }

        IERC20(rewardToken).safeTransfer(caller, amount);

        emit Distribute(amount);

        return amount;
    }

    /// @inheritdoc IERC165
    function supportsInterface(bytes4 interfaceId) public pure returns (bool) {
        return interfaceId == type(IRewardDistributor).interfaceId || interfaceId == type(IERC165).interfaceId;
    }
}
