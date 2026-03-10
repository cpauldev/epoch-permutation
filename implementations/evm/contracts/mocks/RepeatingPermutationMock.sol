// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

contract RepeatingPermutationMock {
    uint256 public immutable MAX_RANGE;
    uint256 public permutationCounter;

    error InvalidRange(uint256 provided);
    error RangeExhausted(uint256 attempted, uint256 maximum);

    constructor(uint256 maxRange) {
        if (maxRange == 0) {
            revert InvalidRange(maxRange);
        }

        MAX_RANGE = maxRange;
    }

    function getNextPermutedValue() external returns (uint256) {
        if (permutationCounter >= MAX_RANGE) {
            revert RangeExhausted(permutationCounter, MAX_RANGE);
        }

        uint256 sequenceIndex = permutationCounter;
        permutationCounter = sequenceIndex + 1;

        if (sequenceIndex == 0 || sequenceIndex == 1) {
            return 1;
        }

        return sequenceIndex;
    }
}
