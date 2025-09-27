// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";

contract HelperConfig is Script {
    struct ContractDetails {
        address eth_router;
        address btc_router;
        address WETH;
    }

    function getMainnetDetails() public view returns (address eth_router, address btc_router, address weth) { }
}
