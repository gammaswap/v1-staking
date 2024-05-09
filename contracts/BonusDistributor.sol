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
    uint256 public override lastDistributionTime;
    address public override rewardTracker;
    bool public override paused = true;

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
        require(_bonusMultiplierBasisPoints <= BASIS_POINTS_DIVISOR, "BonusDistributor: invalid multiplier points");

        IRewardTracker(rewardTracker).updateRewards();
        bonusMultiplierBasisPoints = _bonusMultiplierBasisPoints;

        emit BonusMultiplierChange(_bonusMultiplierBasisPoints);
    }

    /// @inheritdoc IRewardDistributor
    function setPaused(bool _paused) external onlyOwner {
        address _rewardTracker = rewardTracker;
        uint256 timestamp = block.timestamp;

        if (_paused) {
            IRewardTracker(_rewardTracker).updateRewards();
        } else {
            lastDistributionTime = timestamp;
        }

        paused = _paused;

        emit StatusChange(_rewardTracker, timestamp, _paused);
    }

    /// @inheritdoc IRewardDistributor
    function withdrawToken(address _token, address _recipient, uint256 _amount) external onlyOwner {
        if (_token == address(0)) {
            payable(_recipient).transfer(_amount);
        } else {
            IRewardTracker(rewardTracker).updateRewards();
            uint256 maxAmount = maxWithdrawableAmount();
            _amount = _amount == 0 || _amount > maxAmount ? maxAmount : _amount;
            if (_amount > 0) {
                IERC20(_token).safeTransfer(_recipient, _amount);
            }
        }
    }

    /// @inheritdoc IRewardDistributor
    function maxWithdrawableAmount() public view returns (uint256) {
        uint256 rewardsBalance = IERC20(rewardToken).balanceOf(address(this));
        uint256 pending = pendingRewards();

        require(rewardsBalance >= pending, "BonusDistributor: Insufficient funds");
        return rewardsBalance - pending;
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
