import { ethers } from "hardhat";
import { setBalance } from "@nomicfoundation/hardhat-network-helpers";

export async function impersonateAndFund(account: string) {
  const signer = await ethers.getImpersonatedSigner(account.toString());

  setBalance(account, ethers.parseEther('1'));

  return signer;
}

export async function reportGasUsed(tx, label) {
  const receipt = await ethers.provider.getTransactionReceipt(tx.hash)
  if (receipt) {
    console.info(label, receipt.gasUsed.toString())
    return receipt.gasUsed
  }
}