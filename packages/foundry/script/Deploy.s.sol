//SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./DeployHelpers.s.sol";
import { DeployETHPlanner } from "./DeployETHPlanner.s.sol";
import { DeployERC20Planner } from "./DeployERC20Planner.s.sol";

/**
 * @notice Main deployment script for all contracts
 * @dev Run this when you want to deploy multiple contracts at once
 *
 * Example: yarn deploy # runs this script(without`--file` flag)
 */
contract DeployScript is ScaffoldETHDeploy {
    function run() external {
        address ROUTER = 0x2626664c2603336E57B271c5C0b26F421741e481;
        address DEPLOYER = 0x0492D453e080Cb0f0b7D85533354589f62852d61;

        address weth = 0x4200000000000000000000000000000000000006;
        DeployETHPlanner deployEthPlanner = new DeployETHPlanner();
        deployEthPlanner.run(DEPLOYER, ROUTER, weth);

        address cbbtc = 0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf;
        DeployERC20Planner deployCBBTC = new DeployERC20Planner();
        deployCBBTC.run(DEPLOYER, ROUTER, cbbtc);
    }
}
