import { GS, TestLzEndpoint, GS__factory, TestLzEndpoint__factory } from '../typechain-types'
import { ethers } from 'hardhat'
import { expect } from "chai"

describe("GS", async () => {
    let srcGovToken: GS
    let dstGovToken: GS
    let srcLzEndpoint: TestLzEndpoint
    let dstLzEndpoint: TestLzEndpoint
    let deployer: any
    let LzEndpointFactory: TestLzEndpoint__factory;
    let GovTokenFactory: GS__factory;

    const srcChainId = 1
    const dstChainId = 2
    const globalSupply = ethers.parseUnits("16000000", 18)

    beforeEach(async () => {
        [deployer] = await ethers.getSigners();
        // await deployments.fixture(["gs"])
        
        LzEndpointFactory = await ethers.getContractFactory("TestLzEndpoint")
        GovTokenFactory = await ethers.getContractFactory('GS')
        
        srcLzEndpoint = await LzEndpointFactory.deploy(srcChainId);
        dstLzEndpoint = await LzEndpointFactory.deploy(dstChainId);
        srcGovToken = await GovTokenFactory.deploy(srcLzEndpoint.target) as GS
        dstGovToken = await GovTokenFactory.deploy(dstLzEndpoint.target) as GS

        await srcLzEndpoint.setDestLzEndpoint(dstGovToken.target, dstLzEndpoint.target)
        await dstLzEndpoint.setDestLzEndpoint(srcGovToken.target, srcLzEndpoint.target)
        await srcGovToken.setTrustedRemote(dstChainId, ethers.solidityPacked(["address", "address"], [dstGovToken.target, srcGovToken.target]))
        await dstGovToken.setTrustedRemote(srcChainId, ethers.solidityPacked(["address", "address"], [srcGovToken.target, dstGovToken.target]))
        await srcGovToken.setUseCustomAdapterParams(true);
    })

    describe("deployment", async () => {
        it("init values", async () => {
            expect(await srcGovToken.name()).to.equal("GammaSwap")
            expect(await srcGovToken.symbol()).to.equal("GS")

            const totalSupply = await srcGovToken.totalSupply();

            expect(totalSupply).to.equal(globalSupply)
            expect(await srcGovToken.totalSupply()).to.equal(totalSupply)
            expect(await srcGovToken.totalSupply()).to.equal(totalSupply)
        })

        it("Deployer owns everything", async () => {
            const totalSupply = await srcGovToken.totalSupply();
            expect(await srcGovToken.balanceOf(deployer)).to.equal(totalSupply)
        })
    })

    describe("crosschain", async () => {
        it("sendFrom() - tokens from main to other chain using default", async function () {
            // ensure they're both allocated initial amounts
            expect(await srcGovToken.balanceOf(deployer)).to.equal(globalSupply)
            expect(await dstGovToken.balanceOf(deployer)).to.equal(globalSupply)
    
            const amount = ethers.parseUnits("100", 18)
    
            await srcGovToken.setUseCustomAdapterParams(false)
    
            // estimate nativeFees
            let nativeFee = (await srcGovToken.estimateSendFee(dstChainId, deployer.address, amount, false, "0x")).nativeFee

            await srcGovToken.sendFrom(
                deployer.address,
                dstChainId, // destination chainId
                deployer.address, // destination address to send tokens to
                amount, // quantity of tokens to send (in units of wei)
                deployer.address, // LayerZero refund address (if too much fee is sent gets refunded)
                ethers.ZeroAddress, // future parameter
                "0x", // adapterParameters empty bytes specifies default settings
                { value: nativeFee } // pass a msg.value to pay the LayerZero message fee
            )
    
            // verify tokens burned on source chain and minted on destination chain
            expect(await srcGovToken.balanceOf(deployer)).to.be.equal(globalSupply - amount)
            expect(await dstGovToken.balanceOf(deployer)).to.be.equal(globalSupply + amount)
        })
        it("sendFrom() - tokens from main to other chain using adapterParam", async function () {
            // ensure they're both allocated initial amounts
            expect(await srcGovToken.balanceOf(deployer)).to.equal(globalSupply)
            expect(await dstGovToken.balanceOf(deployer)).to.equal(globalSupply)
    
            const amount = ethers.parseUnits("100", 18)

            await srcGovToken.setMinDstGas(dstChainId, await srcGovToken.PT_SEND(), 225000)
            const adapterParam = ethers.solidityPacked(["uint16", "uint256"], [1, 225000])
            // estimate nativeFees
            let nativeFee = (await srcGovToken.estimateSendFee(dstChainId, deployer.address, amount, false, adapterParam)).nativeFee
    
            await srcGovToken.sendFrom(
                deployer.address,
                dstChainId, // destination chainId
                deployer.address, // destination address to send tokens to
                amount, // quantity of tokens to send (in units of wei)
                deployer.address, // LayerZero refund address (if too much fee is sent gets refunded)
                ethers.ZeroAddress, // future parameter
                adapterParam, // adapterParameters empty bytes specifies default settings
                { value: nativeFee } // pass a msg.value to pay the LayerZero message fee
            )
    
            // verify tokens burned on source chain and minted on destination chain
            expect(await srcGovToken.balanceOf(deployer)).to.be.equal(globalSupply - amount)
            expect(await dstGovToken.balanceOf(deployer)).to.be.equal(globalSupply + amount)
        })
    })
})