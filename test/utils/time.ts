import { ethers } from "hardhat";

export async function advanceBlock() {
  return await ethers.provider.send("evm_mine", []);
}

export async function advanceBlockTo(blockNumber: number) {
  for (let i = await ethers.provider.getBlockNumber(); i < blockNumber; i++) {
    await advanceBlock();
  }
}

export async function increase(value: any) {
  await ethers.provider.send("evm_increaseTime", [value]);
  await advanceBlock();
}

export async function latest() {
  const block = await ethers.provider.getBlock("latest")
  return block ? block.timestamp : 0;
}

export async function advanceTimeAndBlock(time: any) {
  await advanceTime(time);
  await advanceBlock();
}

export async function advanceTime(time: any) {
  await ethers.provider.send("evm_increaseTime", [time]);
}

export const duration = {
  seconds: function (val: any) {
    return val
  },
  minutes: function (val: any) {
    return val * this.seconds(60)
  },
  hours: function (val: any) {
    return val * this.minutes(60)
  },
  days: function (val: any) {
    return val * this.hours(24)
  },
  weeks: function (val: any) {
    return val * this.days(7)
  },
  years: function (val: any) {
    return val * this.days(265)
  },
};
