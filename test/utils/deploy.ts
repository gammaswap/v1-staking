import { ethers } from "hardhat"

export async function deployContract(name: string, args: any[], options?: any) {
  const contractFactory = await ethers.getContractFactory(name, options)

  return await contractFactory.deploy(...args)
}

export async function contractAt(name: string, address: string) {
  const contractFactory = await ethers.getContractFactory(name)

  return contractFactory.attach(address)
}
