// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import "./PermutationBenchmarkBase.sol";

/**
 * @title SequentialCounterPermutation
 * @notice Control baseline that emits 1..N without shuffling.
 */
contract SequentialCounterPermutation is PermutationBenchmarkBase {
    constructor(uint256 _maxRange) PermutationBenchmarkBase(_maxRange) {}

    function getNextPermutedValue() public override returns (uint256) {
        _requireAvailable();
        return _consume(permutationCounter + 1);
    }
}
