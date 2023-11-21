// SPDX-License-Identifier: MIT
pragma solidity >=0.8.13;

/// @title DeployerUtils library
/// @author Simon Mall (small@gammaswap.com)
/// @notice Deploy all staking contracts from StakingRouter using proxy calls
library DeployerUtils {
    error ContractDeployError();

    /// @dev Deploy contracts on behalf of staking router
    /// @param _deployer Contract deployer address
    /// @param _data Contract deployment data
    function deployContract(address _deployer, bytes memory _data) internal returns (address) {
        (bool success, bytes memory returndata) = _deployer.delegatecall(_data);

        if (success && returndata.length > 0) {
            return address(uint160(uint256(bytes32(returndata))));
        }

        revert ContractDeployError();
    }
}