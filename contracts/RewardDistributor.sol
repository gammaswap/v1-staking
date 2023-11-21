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
    uint256 public lastDistributionTime;
    address public rewardTracker;

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
    function pendingRewards() public view override returns (uint256) {
        if (block.timestamp == lastDistributionTime) {
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
