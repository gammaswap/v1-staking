// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./interfaces/IStakingRouter.sol";
import "./StakingAdmin.sol";

contract StakingRouter is ReentrancyGuard, StakingAdmin, IStakingRouter {
    constructor(
        address _weth,
        address _gs,
        address _esGs,
        address _bnGs,
        address _manager,
        address _rewardTrackerDeployer,
        address _rewardDistributorDeployer,
        address _vesterDeployer
    ) StakingAdmin(_weth, _gs, _esGs, _bnGs, _manager, _rewardTrackerDeployer, _rewardDistributorDeployer, _vesterDeployer) {}

    receive() external payable {
        require(msg.sender == weth, "StakingRouter: invalid sender");
    }

    function stakeGsForAccount(address _account, uint256 _amount) external nonReentrant {
        _validateHandler();
        _stakeGs(msg.sender, _account, gs, _amount);
    }

    function stakeGs(uint256 _amount) external nonReentrant {
        _stakeGs(msg.sender, msg.sender, gs, _amount);
    }

    function stakeEsGs(uint256 _amount) external nonReentrant {
        _stakeGs(msg.sender, msg.sender, esGs, _amount);
    }

    function stakeGsLp(address _gsPool, uint256 _amount) external nonReentrant {
        _stakeGsLp(msg.sender, msg.sender, _gsPool, _amount);
    }

    function unstakeGs(uint256 _amount) external nonReentrant {
        _unstakeGs(msg.sender, gs, _amount, true);
    }

    function unstakeEsGs(uint256 _amount) external nonReentrant {
        _unstakeGs(msg.sender, esGs, _amount, true);
    }

    function unstakeGsLp(address _gsPool, uint256 _amount) external nonReentrant {
        _unstakeGsLp(msg.sender, _gsPool, _amount);
    }

    function claim() external nonReentrant {
        address account = msg.sender;

        feeRewardTracker.claimForAccount(account, account);
        rewardTracker.claimForAccount(account, account);
        bonusTracker.claimForAccount(account, account);
    }

    function claimPool(address _gsPool) external nonReentrant {
        address account = msg.sender;

        lpRewardTrackers[_gsPool].claimForAccount(account, account);
    }

    function compound() external nonReentrant {
        _compound(msg.sender);
    }

    function compoundForAccount(address _account) external nonReentrant {
        _validateHandler();
        _compound(_account);
    }

    function compoundPool(address _gsPool) external nonReentrant {
        _compoundPool(_gsPool, msg.sender);
    }

    function compoundPoolForAccount(address _gsPool, address _account) external nonReentrant {
        _validateHandler();
        _compoundPool(_gsPool, _account);
    }

    function _validateHandler() private view {
        address user = msg.sender;
        require(owner() == user || manager == user, "StakingRouter: forbidden");
    }

    function _stakeGs(address _fundingAccount, address _account, address _token, uint256 _amount) private {
        require(_amount > 0, "StakingRouter: invalid amount");

        rewardTracker.stakeForAccount(_fundingAccount, _account, _token, _amount);
        bonusTracker.stakeForAccount(_account, _account, address(rewardTracker), _amount);
        feeRewardTracker.stakeForAccount(_account, _account, address(bonusTracker), _amount);

        emit StakeGs(_account, _token, _amount);
    }

    function _stakeGsLp(address _fundingAccount, address _account, address _gsPool, uint256 _amount) private {
        require(_amount > 0, "StakingRouter: invalid amount");

        lpRewardTrackers[_gsPool].stakeForAccount(_fundingAccount, _account, _gsPool, _amount);

        emit StakeGsLp(_account, _gsPool, _amount);
    }

    function _unstakeGs(address _account, address _token, uint256 _amount, bool _shouldReduceBnGs) private {
        require(_amount > 0, "StakingRouter: invalid amount");

        feeRewardTracker.unstakeForAccount(_account, address(bonusTracker), _amount, _account);
        bonusTracker.unstakeForAccount(_account, address(rewardTracker), _amount, _account);
        rewardTracker.unstakeForAccount(_account, _token, _amount, _account);

        if (_shouldReduceBnGs) {
            uint256 balance = rewardTracker.stakedAmounts(_account);
            uint256 bnGsAmount = bonusTracker.claimForAccount(_account, _account);
            if (bnGsAmount > 0) {
                feeRewardTracker.stakeForAccount(_account, _account, bnGs, bnGsAmount);
            }

            uint256 stakedBnGs = feeRewardTracker.depositBalances(_account, bnGs);
            if (stakedBnGs > 0) {
                uint256 reductionAmount = stakedBnGs * _amount / balance;
                feeRewardTracker.unstakeForAccount(_account, bnGs, reductionAmount, _account);
                // bnGs.burn(_account, reductionAmount);
            }
        }

        emit UnstakeGs(_account, _token, _amount);
    }

    function _unstakeGsLp(address _account, address _gsPool, uint256 _amount) private {
        require(_amount > 0, "StakingRouter: invalid amount");

        lpRewardTrackers[_gsPool].unstakeForAccount(_account, _gsPool, _amount, _account);

        emit UnstakeGsLp(_account, _gsPool, _amount);
    }

    function _compound(address _account) private {
        uint256 esGsAmount = rewardTracker.claimForAccount(_account, _account);
        if (esGsAmount > 0) {
            _stakeGs(_account, _account, esGs, esGsAmount);
        }

        uint256 bnGsAmount = bonusTracker.claimForAccount(_account, _account);
        if (bnGsAmount > 0) {
            feeRewardTracker.stakeForAccount(_account, _account, bnGs, bnGsAmount);
        }
    }

    function _compoundPool(address _gsPool, address _account) private {
        uint256 esGsAmount = lpRewardTrackers[_gsPool].claimForAccount(_account, _account);
        if (esGsAmount > 0) {
            _stakeGsLp(_account, _account, _gsPool, esGsAmount);
        }
    }
}