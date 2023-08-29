// SPDX-License-Identifier: BUSL-1.1
pragma solidity >=0.8.4;

import "forge-std/Test.sol";

import "../../../contracts/tokens/GS.sol";
import "../../../contracts/tokens/RestrictedToken.sol";
import "../../../contracts/test/ERC20Mock.sol";

contract TokensSetup is Test {

    ERC20Mock public weth;
    ERC20Mock public usdc;
    RestrictedToken public gs;
    RestrictedToken public esGs;
    RestrictedToken public esGsb;
    RestrictedToken public bnGs;

    function createTokens() public {
        weth = new ERC20Mock("Wrapped Ethereum", "WETH");
        usdc = new ERC20Mock("USDC", "USDC");
        gs = new GS();
        esGs = new RestrictedToken("Escrowed GS", "esGs");
        esGsb = new RestrictedToken("Escrowed GS for Borrowers", "esGs");
        bnGs = new RestrictedToken("Bonus GS", "bnGs");
    }

    function mintTokens(address user, uint256 amount) public {
        usdc.mint(user, amount);
        weth.mint(user, amount);
        // gs.mint(user, amount);
        // esGs.mint(user, amount);
        // esGsb.mint(user, amount);
        // bnGs.mint(user, amount);
    }
}