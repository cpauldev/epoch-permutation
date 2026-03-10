// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

/**
 * @title PermutationBenchmarkBase
 * @notice Shared benchmark interface for bounded-range unique sequence generators.
 */
abstract contract PermutationBenchmarkBase {
    uint256 public immutable MAX_RANGE;
    uint256 public permutationCounter;

    event PermutationExecuted(
        uint256 indexed sequenceIndex,
        uint256 permutedValue
    );

    error RangeExhausted(uint256 attempted, uint256 maximum);
    error InvalidRange(uint256 provided);

    constructor(uint256 _maxRange) {
        if (_maxRange == 0) revert InvalidRange(_maxRange);
        MAX_RANGE = _maxRange;
    }

    function getNextPermutedValue() public virtual returns (uint256);

    function _requireAvailable() internal view {
        if (permutationCounter >= MAX_RANGE) {
            revert RangeExhausted(permutationCounter, MAX_RANGE);
        }
    }

    function _consume(uint256 permutedValue) internal returns (uint256) {
        uint256 sequenceIndex = permutationCounter;
        permutationCounter = sequenceIndex + 1;
        emit PermutationExecuted(sequenceIndex, permutedValue);
        return permutedValue;
    }
}
