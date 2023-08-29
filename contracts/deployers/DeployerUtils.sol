// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

library DeployerUtils {
    error ContractDeployError();

    function deployContract(address _deployer, bytes memory _data) internal returns (address) {
        (bool success, bytes memory returndata) = _deployer.delegatecall(_data);

        if (success && returndata.length > 0) {
            return address(uint160(uint256(bytes32(returndata))));
        }

        revert ContractDeployError();
    }
}