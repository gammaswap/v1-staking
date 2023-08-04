// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "./RewardTracker.sol";

contract FeeTracker is RewardTracker {
    address public bonusTracker;
    address public bnGs;
    uint256 public bnRateCap;

    constructor(uint256 _bnRateCap) RewardTracker("GammaSwap Revenue Share", "feeGS") {
        bnRateCap = _bnRateCap;
    }

    /// @param _depositTokens should be two tokens
    /// _depositTokens[0] - bonusTracker (GS + esGS + esGSb)
    /// _depositTokens[1] - bnGS (aka MP)
    function initialize(
        address[] memory _depositTokens,
        address _distributor
    ) external override onlyOwner {
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
    function setBonusLimit(uint256 _bnRateCap) external onlyOwner {
        bnRateCap = _bnRateCap;
    }

    function _updateRewards(address _account) internal override {
        uint256 blockReward = IRewardDistributor(distributor).distribute();

        uint256 supply = totalSupply;
        uint256 _cumulativeRewardPerToken = cumulativeRewardPerToken;
        if (supply > 0 && blockReward > 0) {
            _cumulativeRewardPerToken = _cumulativeRewardPerToken + blockReward * PRECISION / supply;
            cumulativeRewardPerToken = _cumulativeRewardPerToken;
        }

        // cumulativeRewardPerToken can only increase
        // so if cumulativeRewardPerToken is zero, it means there are no rewards yet
        if (_cumulativeRewardPerToken == 0) {
            return;
        }

        if (_account != address(0)) {
            uint256 depositBalance = depositBalances[_account][bonusTracker];
            uint256 bonusBalance = depositBalances[_account][bnGs];
            {   // stack too deep
                uint256 maxUsableBonusAmount = depositBalance * bnRateCap / 1e4;
                if (bonusBalance > maxUsableBonusAmount) {
                    bonusBalance = maxUsableBonusAmount;
                }
            }
            uint256 stakedAmount = depositBalance + bonusBalance;
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
}