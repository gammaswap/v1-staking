// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "@gammaswap/v1-core/contracts/GammaPoolFactory.sol";
import "@gammaswap/v1-core/contracts/base/PoolViewer.sol";
import "@gammaswap/v1-implementations/contracts/pools/CPMMGammaPool.sol";
import "@gammaswap/v1-implementations/contracts/strategies/cpmm/lending/CPMMBorrowStrategy.sol";
import "@gammaswap/v1-implementations/contracts/strategies/cpmm/lending/CPMMRepayStrategy.sol";
import "@gammaswap/v1-implementations/contracts/strategies/cpmm/liquidation/CPMMLiquidationStrategy.sol";
import "@gammaswap/v1-implementations/contracts/strategies/cpmm/liquidation/CPMMBatchLiquidationStrategy.sol";
import "@gammaswap/v1-implementations/contracts/strategies/cpmm/CPMMShortStrategy.sol";
import "@gammaswap/v1-implementations/contracts/libraries/cpmm/CPMMMath.sol";
import "@gammaswap/v1-periphery/contracts/interfaces/IPositionManager.sol";

import "./UniswapSetup.sol";
import "./RouterSetup.sol";

contract CPMMGammaSwapSetup is UniswapSetup, RouterSetup {
    GammaPoolFactory public factory;
    IPositionManager public manager;

    CPMMBorrowStrategy public longStrategy;
    CPMMRepayStrategy public repayStrategy;
    CPMMShortStrategy public shortStrategy;
    CPMMLiquidationStrategy public liquidationStrategy;
    CPMMBatchLiquidationStrategy public batchLiquidationStrategy;
    CPMMGammaPool public protocol;
    CPMMGammaPool public pool;
    IPoolViewer public viewer;

    CPMMMath public mathLib;

    address public cfmm;
    address public owner;

    address user1;
    address user2;

    function initCPMMGammaSwap() public {
        owner = address(this);
        user1 = vm.addr(5);
        user2 = vm.addr(6);

        createTokens();
        mintTokens(user1, 4 * 1e24);
        mintTokens(user2, 4 * 1e24);

        //////// BEGIN: GammaSwap Core setup ////////
        initUniswap(owner, address(weth));
        approveUniRouter();

        factory = new GammaPoolFactory(owner);

        uint16 PROTOCOL_ID = 1;
        uint64 baseRate = 1e16;
        uint80 factor = 4 * 1e16;
        uint80 maxApy = 75 * 1e16;
        uint256 maxTotalApy = 1e19;

        mathLib = new CPMMMath();
        viewer = new PoolViewer();
        longStrategy = new CPMMBorrowStrategy(address(mathLib), maxTotalApy, 2252571, 997, 1000, baseRate, factor, maxApy);
        repayStrategy = new CPMMRepayStrategy(address(mathLib), maxTotalApy, 2252571, 997, 1000, baseRate, factor, maxApy);
        shortStrategy = new CPMMShortStrategy(maxTotalApy, 2252571, baseRate, factor, maxApy);
        liquidationStrategy = new CPMMLiquidationStrategy(address(mathLib), maxTotalApy, 2252571, 997, 1000, baseRate, factor, maxApy);
        batchLiquidationStrategy = new CPMMBatchLiquidationStrategy(address(mathLib), maxTotalApy, 2252571, 997, 1000, baseRate, factor, maxApy);

        bytes32 cfmmHash = hex'96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f'; // UniV2Pair init_code_hash
        protocol = new CPMMGammaPool(PROTOCOL_ID, address(factory), address(longStrategy), address(repayStrategy), address(shortStrategy),
            address(liquidationStrategy), address(batchLiquidationStrategy), address(viewer), address(0), address(0), address(uniFactory), cfmmHash);

        factory.addProtocol(address(protocol));

        address[] memory tokens = new address[](2);
        tokens[0] = address(weth);
        tokens[1] = address(usdc);

        cfmm = createPair(tokens[0], tokens[1]);

        pool = CPMMGammaPool(factory.createPool(PROTOCOL_ID, cfmm, tokens, new bytes(0)));

        factory.setPoolParams(address(pool), 0, 0, 10, 100, 100, 0, 250, 200);// setting origination fees to zero

        approvePool();
        //////// END: GammaSwap Core setup ////////

        //////// START: PositionManager ////////
        bytes memory managerArgs = abi.encode(address(factory), address(weth), address(0), address(0));
        bytes memory managerBytecode = abi.encodePacked(vm.getCode("./node_modules/@gammaswap/v1-periphery/artifacts/contracts/PositionManager.sol/PositionManager.json"), managerArgs);
        assembly {
            sstore(manager.slot, create(0, add(managerBytecode, 0x20), mload(managerBytecode)))
        }
        //////// END: PositionManager ////////

        //////// START: Staking ////////
        setupRouter(address(factory), address(manager), address(pool));
        //////// END: Staking ////////
    }

    function approveUniRouter() public {
        vm.startPrank(user1);
        usdc.approve(address(uniRouter), type(uint256).max);
        weth.approve(address(uniRouter), type(uint256).max);
        vm.stopPrank();

        vm.startPrank(user2);
        usdc.approve(address(uniRouter), type(uint256).max);
        weth.approve(address(uniRouter), type(uint256).max);
        vm.stopPrank();
    }

    function approvePool() public {
        vm.startPrank(user1);
        pool.approve(address(pool), type(uint256).max);
        IERC20(cfmm).approve(address(pool), type(uint256).max);
        vm.stopPrank();

        vm.startPrank(user2);
        pool.approve(address(pool), type(uint256).max);
        IERC20(cfmm).approve(address(pool), type(uint256).max);
        vm.stopPrank();
    }

    function depositLiquidityInPool(address addr) public {
        vm.startPrank(addr);
        uint256 lpTokens = IERC20(cfmm).balanceOf(addr);
        pool.deposit(lpTokens, addr);
        vm.stopPrank();

    }
    function depositLiquidityInCFMM(address addr, uint256 usdcAmount, uint256 wethAmount) public {
        vm.startPrank(addr);
        addLiquidity(address(usdc), address(weth), usdcAmount, wethAmount, addr); // 1 weth = 1,000 USDC
        vm.stopPrank();
    }
}
