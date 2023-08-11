// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "./IStakingAdmin.sol";

interface IStakingRouter is IStakingAdmin {
    /* Stake */
    function stakeGsForAccount(address, uint256) external;
    function stakeGs(uint256) external;
    function stakeEsGs(uint256) external;
    function stakeEsGsb(uint256) external;
    function stakeLpForAccount(address, address, uint256) external;
    function stakeLp(address, uint256) external;
    function stakeLoanForAccount(address, address, uint256) external;
    function stakeLoan(address, uint256) external;
    function unstakeGs(uint256) external;
    function unstakeEsGs(uint256) external;
    function unstakeEsGsb(uint256) external;
    function unstakeLpForAccount(address, address, uint256) external;
    function unstakeLp(address, uint256) external;
    function unstakeLoanForAccount(address, address, uint256) external;
    function unstakeLoan(address, uint256) external;

    /* Vest */
    function vestEsGs(uint256) external;
    function vestEsGsForPool(address, uint256) external;
    function vestEsGsb(uint256) external;
    function withdrawEsGs() external;
    function withdrawEsGsForPool(address) external;
    function withdrawEsGsb() external;

    /* Claim */
    function claim() external;
    function claimPool(address) external;

    /* Compound */
    function compound() external;
    function compoundForAccount(address) external;

    event StakedGs(address, address, uint256);
    event StakedLp(address, address, uint256);
    event StakedLoan(address, address, uint256);
    event UnstakedGs(address, address, uint256);
    event UnstakedLp(address, address, uint256);
    event UnstakedLoan(address, address, uint256);
}