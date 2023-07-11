// SPDX-License-Identifier: MIT

pragma solidity 0.8.18;

import "./IStakingAdmin.sol";

interface IStakingRouter is IStakingAdmin {
    event StakeGs(address account, address token, uint256 amount);
    event UnstakeGs(address account, address token, uint256 amount);

    event StakeGsLp(address account, address gsPool, uint256 amount);
    event UnstakeGsLp(address account, address gsPool, uint256 amount);
}