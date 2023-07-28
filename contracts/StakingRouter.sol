// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./interfaces/IStakingRouter.sol";
import "./StakingAdmin.sol";

contract StakingRouter is ReentrancyGuard, StakingAdmin, IStakingRouter {
    constructor(
        address _weth,
        address _gs,
        address _esGslp,
        address _esGsb,
        address _bnGs,
        address _factory,
        address _manager,
        address _rewardTrackerDeployer,
        address _rewardDistributorDeployer,
        address _vesterDeployer
    ) StakingAdmin(_weth, _gs, _esGslp, _esGsb, _bnGs, _factory, _manager, _rewardTrackerDeployer, _rewardDistributorDeployer, _vesterDeployer) {}

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

    function stakeEsGslp(uint256 _amount) external nonReentrant {
        _stakeGs(msg.sender, msg.sender, esGslp, _amount);
    }

    function stakeEsGsb(uint256 _amount) external nonReentrant {
        _stakeGs(msg.sender, msg.sender, esGsb, _amount);
    }

    function stakeLpForAccount(address _account, address _gsPool, uint256 _amount) external nonReentrant {
        _validateHandler();
        _stakeLp(_account, _account, _gsPool, _amount);
    }

    function stakeLp(address _gsPool, uint256 _amount) external nonReentrant {
        _stakeLp(msg.sender, msg.sender, _gsPool, _amount);
    }

    function stakeLoanForAccount(address _account, address _gsPool, uint256 _loanId) external nonReentrant {
        _validateHandler();
        _stakeLoan(_account, _gsPool, _loanId);
    }

    function stakeLoan(address _gsPool, uint256 _loanId) external nonReentrant {
        _stakeLoan(msg.sender, _gsPool, _loanId);
    }

    function unstakeGs(uint256 _amount) external nonReentrant {
        _unstakeGs(msg.sender, gs, _amount, true);
    }

    function unstakeEsGslp(uint256 _amount) external nonReentrant {
        _unstakeGs(msg.sender, esGslp, _amount, true);
    }

    function unstakeEsGsb(uint256 _amount) external nonReentrant {
        _unstakeGs(msg.sender, esGsb, _amount, true);
    }

    function unstakeLpForAccount(address _account, address _gsPool, uint256 _amount) external nonReentrant {
        _validateHandler();
        _unstakeLp(_account, _gsPool, _amount);
    }

    function unstakeLp(address _gsPool, uint256 _amount) external nonReentrant {
        _unstakeLp(msg.sender, _gsPool, _amount);
    }

    function unstakeLoanForAccount(address _account, address _gsPool, uint256 _loanId) external nonReentrant {
        _validateHandler();
        _unstakeLoan(_account, _gsPool, _loanId);
    }

    function unstakeLoan(address _gsPool, uint256 _loanId) external nonReentrant {
        _unstakeLoan(msg.sender, _gsPool, _loanId);
    }

    function vestEsGslp(uint256 _amount) external nonReentrant {
        IVester(coreTracker.vester).depositForAccount(msg.sender, _amount);
    }

    function vestEsGslpForPool(address _gsPool, uint256 _amount) external nonReentrant {
        IVester(poolTrackers[_gsPool].vester).depositForAccount(msg.sender, _amount);
    }

    function vestEsGsb(uint256 _amount) external nonReentrant {
        IVester(coreTracker.loanVester).depositForAccount(msg.sender, _amount);
    }

    function withdrawEsGslp() external nonReentrant {
        IVester(coreTracker.vester).withdrawForAccount(msg.sender);
    }

    function withdrawEsGslpForPool(address _gsPool) external nonReentrant {
        IVester(poolTrackers[_gsPool].vester).withdrawForAccount(msg.sender);
    }

    function withdrawEsGsb() external nonReentrant {
        IVester(coreTracker.loanVester).withdrawForAccount(msg.sender);
    }

    function claim() external nonReentrant {
        address account = msg.sender;

        IRewardTracker(coreTracker.feeTracker).claimForAccount(account, account);
        IRewardTracker(coreTracker.rewardTracker).claimForAccount(account, account);
        IRewardTracker(coreTracker.loanRewardTracker).claimForAccount(account, account);
        IRewardTracker(coreTracker.bonusTracker).claimForAccount(account, account);
        IVester(coreTracker.vester).claimForAccount(account, account);
        IVester(coreTracker.loanVester).claimForAccount(account, account);
    }

    function claimPool(address _gsPool) external nonReentrant {
        address account = msg.sender;

        IRewardTracker(poolTrackers[_gsPool].rewardTracker).claimForAccount(account, account);
        ILoanTracker(poolTrackers[_gsPool].loanRewardTracker).claimForAccount(account, account);
        IVester(poolTrackers[_gsPool].vester).claimForAccount(account, account);
    }

    function compound() external nonReentrant {
        _compound(msg.sender);
    }

    function compoundForAccount(address _account) external nonReentrant {
        _validateHandler();
        _compound(_account);
    }

    function _validateHandler() private view {
        address user = msg.sender;
        require(owner() == user || manager == user, "StakingRouter: forbidden");
    }

    function _stakeGs(address _fundingAccount, address _account, address _token, uint256 _amount) private {
        require(_amount > 0, "StakingRouter: invalid amount");

        address rewardTracker = coreTracker.rewardTracker;
        address bonusTracker = coreTracker.bonusTracker;
        address feeTracker = coreTracker.feeTracker;

        IRewardTracker(rewardTracker).stakeForAccount(_fundingAccount, _account, _token, _amount);
        IRewardTracker(bonusTracker).stakeForAccount(_account, _account, rewardTracker, _amount);
        IRewardTracker(feeTracker).stakeForAccount(_account, _account, bonusTracker, _amount);

        emit StakedGs(_account, _token, _amount);
    }

    function _stakeLp(address _fundingAccount, address _account, address _gsPool, uint256 _amount) private {
        require(_amount > 0, "StakingRouter: invalid amount");

        IRewardTracker(poolTrackers[_gsPool].rewardTracker).stakeForAccount(_fundingAccount, _account, _gsPool, _amount);

        emit StakedLp(_account, _gsPool, _amount);
    }

    function _stakeLoan(address _account, address _gsPool, uint256 _loanId) private {
        ILoanTracker(poolTrackers[_gsPool].loanRewardTracker).stakeForAccount(_account, _loanId);

        emit StakedLoan(_account, _gsPool, _loanId);
    }

    function _unstakeGs(address _account, address _token, uint256 _amount, bool _shouldReduceBnGs) private {
        require(_amount > 0, "StakingRouter: invalid amount");

        address rewardTracker = coreTracker.rewardTracker;
        address bonusTracker = coreTracker.bonusTracker;
        address feeTracker = coreTracker.feeTracker;

        IRewardTracker(feeTracker).unstakeForAccount(_account, bonusTracker, _amount, _account);
        IRewardTracker(bonusTracker).unstakeForAccount(_account, rewardTracker, _amount, _account);
        IRewardTracker(rewardTracker).unstakeForAccount(_account, _token, _amount, _account);

        if (_shouldReduceBnGs) {
            uint256 balance = IRewardTracker(coreTracker.rewardTracker).stakedAmounts(_account);
            uint256 bnGsAmount = IRewardTracker(coreTracker.bonusTracker).claimForAccount(_account, _account);
            if (bnGsAmount > 0) {
                IRewardTracker(feeTracker).stakeForAccount(_account, _account, bnGs, bnGsAmount);
            }

            uint256 stakedBnGs = IRewardTracker(feeTracker).depositBalances(_account, bnGs);
            if (stakedBnGs > 0) {
                uint256 reductionAmount = stakedBnGs * _amount / balance;
                IRewardTracker(feeTracker).unstakeForAccount(_account, bnGs, reductionAmount, _account);
                // bnGs.burn(_account, reductionAmount);
            }
        }

        emit UnstakedGs(_account, _token, _amount);
    }

    function _unstakeLp(address _account, address _gsPool, uint256 _amount) private {
        require(_amount > 0, "StakingRouter: invalid amount");

        IRewardTracker(poolTrackers[_gsPool].rewardTracker).unstakeForAccount(_account, _gsPool, _amount, _account);

        emit UnstakedLp(_account, _gsPool, _amount);
    }

    function _unstakeLoan(address _account, address _gsPool, uint256 _loanId) private {
        ILoanTracker(poolTrackers[_gsPool].loanRewardTracker).unstakeForAccount(_account, _loanId);

        emit UnstakedLoan(_account, _gsPool, _loanId);
    }

    function _compound(address _account) private {
        uint256 esGslpAmount = IRewardTracker(coreTracker.rewardTracker).claimForAccount(_account, _account);
        if (esGslpAmount > 0) {
            _stakeGs(_account, _account, esGslp, esGslpAmount);
        }

        uint256 esGsbAmount = IRewardTracker(coreTracker.loanRewardTracker).claimForAccount(_account, _account);
        if (esGsbAmount > 0) {
            _stakeGs(_account, _account, esGsb, esGsbAmount);
        }

        uint256 bnGsAmount = IRewardTracker(coreTracker.bonusTracker).claimForAccount(_account, _account);
        if (bnGsAmount > 0) {
            IRewardTracker(coreTracker.feeTracker).stakeForAccount(_account, _account, bnGs, bnGsAmount);
        }
    }
}