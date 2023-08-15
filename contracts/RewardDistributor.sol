// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";

import "./interfaces/IRewardDistributor.sol";
import "./interfaces/IRewardTracker.sol";

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

    function updateLastDistributionTime() external onlyOwner {
        lastDistributionTime = block.timestamp;
    }

    function setTokensPerInterval(uint256 _amount) external onlyOwner {
        require(lastDistributionTime != 0, "RewardDistributor: invalid lastDistributionTime");

        IRewardTracker(rewardTracker).updateRewards();
        tokensPerInterval = _amount;

        emit TokensPerIntervalChange(_amount);
    }

    function pendingRewards() public view override returns (uint256) {
        if (block.timestamp == lastDistributionTime) {
            return 0;
        }

        uint256 timeDiff = block.timestamp - lastDistributionTime;

        return tokensPerInterval * timeDiff;
    }

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

    function supportsInterface(bytes4 interfaceId) public pure returns (bool) {
        return interfaceId == type(IRewardDistributor).interfaceId || interfaceId == type(IERC165).interfaceId;
    }
}
