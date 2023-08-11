import { ethers } from "hardhat";
import { setBalance } from "@nomicfoundation/hardhat-network-helpers";

export async function impersonateAndFund(account: string) {
  const signer = await ethers.getImpersonatedSigner(account.toString());

  setBalance(account, ethers.parseEther('1'));

  return signer;
}