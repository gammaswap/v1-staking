// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "./IStakingAdmin.sol";

interface IStakingRouter is IStakingAdmin {
    function stakeGsForAccount(address, uint256) external;
    function stakeGs(uint256) external;
    function stakeEsGslp(uint256) external;
    function stakeGsLp(address, uint256) external;
    function unstakeGs(uint256) external;
    function unstakeEsGslp(uint256) external;
    function unstakeGsLp(address, uint256) external;
    function claim() external;
    function claimPool(address) external;
    function compound() external;
    function compoundForAccount(address) external;
    function compoundPool(address) external;
    function compoundPoolForAccount(address, address) external;

    event StakeGs(address, address, uint256);
    event StakeGsLp(address, address, uint256);
    event UnstakeGs(address, address, uint256);
    event UnstakeGsLp(address, address, uint256);
}