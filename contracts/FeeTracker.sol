// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

import "./interfaces/IFeeTracker.sol";
import "./RewardTracker.sol";

/// @title FeeTracker Contract
/// @author Simon Mall
/// @notice Earns protocol revenue share using actively staked GS/esGS/esGSb/bnGS
contract FeeTracker is IFeeTracker, RewardTracker {
    address public override bonusTracker;
    address public override bnGs;
    uint256 public override bnRateCap;
    uint256 public override totalInactivePoints;
    mapping (address => uint256) public override inactivePoints;

    constructor(uint256 _bnRateCap) RewardTracker("GammaSwap Revenue Share", "feeGS") {
        bnRateCap = _bnRateCap;
    }

    /// @param _depositTokens should be two tokens
    /// _depositTokens[0] - bonusTracker (GS + esGS + esGSb)
    /// _depositTokens[1] - bnGS (aka MP)
    function initialize(
        address[] memory _depositTokens,
        address _distributor
    ) external virtual override(IRewardTracker, RewardTracker) onlyOwner {
        require(!isInitialized, "FeeTracker: already initialized");
        isInitialized = true;

        require(_depositTokens.length == 2, "FeeTracker: invalid token setup");

        isDepositToken[_depositTokens[0]] = true;
        isDepositToken[_depositTokens[1]] = true;

        bonusTracker = _depositTokens[0];
        bnGs = _depositTokens[1];
        distributor = _distributor;
    }

    /// @param _bnRateCap bonus utilization rate
    /// 10000 -> 100%
    /// 100 -> 1%
    function setBonusLimit(uint256 _bnRateCap) external virtual override onlyOwner {
        bnRateCap = _bnRateCap;
    }

    /// @inheritdoc RewardTracker
    /// @dev Only active MP tokens contribute to rewards (See `bnRateCap`)
    function claimable(address _account) public virtual override(RewardTracker, IRewardTracker) view returns (uint256) {
        uint256 stakedAmount = stakedAmounts[_account] - inactivePoints[_account];
        uint256 _claimableReward = claimableReward[_account];
        if (stakedAmount == 0) {
            return _claimableReward;
        }

        uint256 supply = totalSupply - totalInactivePoints;
        uint256 pendingRewards = IRewardDistributor(distributor).pendingRewards() * PRECISION;
        uint256 nextCumulativeRewardPerToken = cumulativeRewardPerToken + pendingRewards / supply;

        return _claimableReward + (stakedAmount * (nextCumulativeRewardPerToken - previousCumulatedRewardPerToken[_account]) / PRECISION);
    }

    /// @dev Stake tokens to earn rewards
    /// @dev Update inactive MP amounts for the user
    function _stake(address _fundingAccount, address _account, address _depositToken, uint256 _amount) internal virtual override {
        super._stake(_fundingAccount, _account, _depositToken, _amount);

        _updateInactivePoints(_account);
    }

    /// @dev Unstake tokens to earn rewards
    /// @dev Update inactive MP amounts for the user
    function _unstake(address _account, address _depositToken, uint256 _amount, address _receiver) internal virtual override {
        super._unstake(_account, _depositToken, _amount, _receiver);

        _updateInactivePoints(_account);
    }

    /// @dev Calculate rewards amount for the user
    /// @param _account User earning rewards
    function _updateRewards(address _account) internal virtual override {
        uint256 blockReward = IRewardDistributor(distributor).distribute();

        uint256 supply = totalSupply - totalInactivePoints;
        uint256 _cumulativeRewardPerToken = cumulativeRewardPerToken;
        if (supply > 0 && blockReward > 0) {
            _cumulativeRewardPerToken = _cumulativeRewardPerToken + blockReward * PRECISION / supply;
            cumulativeRewardPerToken = _cumulativeRewardPerToken;
        }

        if (_cumulativeRewardPerToken == 0) {
            return;
        }

        if (_account != address(0)) {
            uint256 stakedAmount = stakedAmounts[_account] - inactivePoints[_account];
            uint256 accountReward = stakedAmount * (_cumulativeRewardPerToken - previousCumulatedRewardPerToken[_account]) / PRECISION;
            uint256 _claimableReward = claimableReward[_account] + accountReward;

            claimableReward[_account] = _claimableReward;
            previousCumulatedRewardPerToken[_account] = _cumulativeRewardPerToken;

            if (_claimableReward > 0 && stakedAmount > 0) {
                uint256 cumulativeReward = cumulativeRewards[_account];
                uint256 nextCumulativeReward = cumulativeReward + accountReward;

                averageStakedAmounts[_account] = averageStakedAmounts[_account] * cumulativeReward / nextCumulativeReward + stakedAmount * accountReward / nextCumulativeReward;

                cumulativeRewards[_account] = nextCumulativeReward;
            }
        }
    }

    /// @dev Update inactive MP amounts for the user
    function _updateInactivePoints(address _account) private {
        uint256 depositBalance = depositBalances[_account][bonusTracker];
        uint256 bonusBalance = depositBalances[_account][bnGs];
        uint256 maxUsableBonusAmount = depositBalance * bnRateCap / 1e4;
        uint256 _inactivePoint = 0;
        if (bonusBalance > maxUsableBonusAmount) {
            _inactivePoint = bonusBalance - maxUsableBonusAmount;
        }
        totalInactivePoints = totalInactivePoints + _inactivePoint - inactivePoints[_account];
        inactivePoints[_account] = _inactivePoint;

        require(totalSupply > totalInactivePoints, "FeeTracker: Something quite wrong");
    }
}