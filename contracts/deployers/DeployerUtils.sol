// SPDX-License-Identifier: MIT

pragma solidity 0.8.17;

bytes4 constant REWARD_TRACKER_DEPLOYER = bytes4(keccak256("deploy(string,string)"));
bytes4 constant LOAN_TRACKER_DEPLOYER = bytes4(keccak256("deployLoanTracker(address,uint16,address,string,string)"));
bytes4 constant FEE_TRACKER_DEPLOYER = bytes4(keccak256("deploy(uint256)"));
bytes4 constant REWARD_DISTRIBUTOR_DEPLOYER = bytes4(keccak256("deploy(address,address)"));
bytes4 constant BONUS_DISTRIBUTOR_DEPLOYER = bytes4(keccak256("deployBonusDistributor(address,address)"));
bytes4 constant VESTER_DEPLOYER = bytes4(keccak256("deploy(string,string,uint256,address,address,address,address)"));
bytes4 constant VESTER_NORESERVE_DEPLOYER = bytes4(keccak256("deployVesterNoReserve(string,string,uint256,address,address,address)"));

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