// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

import "./interfaces/IRewardDistributor.sol";
import "./interfaces/IRewardTracker.sol";

/// @title RewardDistributor contract
/// @author Simon Mall (small@gammaswap.com)
/// @notice Distributes rewards to RewardTracker contracts on demand
contract RewardDistributor is Ownable2Step, IRewardDistributor {
    using SafeERC20 for IERC20;

    address public override rewardToken;
    uint256 public override tokensPerInterval;
    uint256 public override lastDistributionTime;
    address public override rewardTracker;
    bool public override paused = true;

    constructor(address _rewardToken, address _rewardTracker) {
        rewardToken = _rewardToken;
        rewardTracker = _rewardTracker;
    }

    /// @inheritdoc IRewardDistributor
    function updateLastDistributionTime() external onlyOwner {
        lastDistributionTime = block.timestamp;
    }

    /// @dev Set reward token emission rate
    /// @param _amount Amount of reward tokens per second
    function setTokensPerInterval(uint256 _amount) external onlyOwner {
        require(lastDistributionTime != 0, "RewardDistributor: invalid lastDistributionTime");

        IRewardTracker(rewardTracker).updateRewards();
        tokensPerInterval = _amount;

        emit TokensPerIntervalChange(_amount);
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

        require(rewardsBalance >= pending, "RewardDistributor: Insufficient funds");
        return rewardsBalance - pending;
    }

    /// @inheritdoc IRewardDistributor
    function pendingRewards() public view override returns (uint256) {
        if (paused || block.timestamp == lastDistributionTime) {
            return 0;
        }

        uint256 timeDiff = block.timestamp - lastDistributionTime;

        return tokensPerInterval * timeDiff;
    }

    /// @inheritdoc IRewardDistributor
    function distribute() external override returns (uint256) {
        address caller = msg.sender;
        require(caller == rewardTracker, "RewardDistributor: invalid msg.sender");

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
