// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";

contract PathEncodingTest is Test {
    function testPathLength() public pure {
        // Test Uniswap V3 path encoding for single hop: address(20) + uint24(3) + address(20) = 43 bytes
        address tokenA = 0xA0b86A33e6417C2F9B8a4f3bFA3Ca7ae2f8C3d0F;
        uint24 fee = 500;
        address tokenB = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

        bytes memory path = abi.encodePacked(tokenA, fee, tokenB);

        // Path should be exactly 43 bytes: 20 + 3 + 20 = 43
        assertEq(path.length, 43, "Path should be 43 bytes for single hop");
    }

    function testMultiHopPathLength() public pure {
        // Test multi-hop path: address + uint24 + address + uint24 + address = 20 + 3 + 20 + 3 + 20 = 66 bytes
        address tokenA = 0xA0b86A33e6417C2F9B8a4f3bFA3Ca7ae2f8C3d0F;
        uint24 fee1 = 500;
        address tokenB = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
        uint24 fee2 = 3000;
        address tokenC = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;

        bytes memory path = abi.encodePacked(tokenA, fee1, tokenB, fee2, tokenC);

        // Path should be exactly 66 bytes for two hops
        assertEq(path.length, 66, "Path should be 66 bytes for two hops");
    }
}