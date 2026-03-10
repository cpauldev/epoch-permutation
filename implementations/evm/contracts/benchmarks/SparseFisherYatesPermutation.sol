// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import "./PermutationBenchmarkBase.sol";

/**
 * @title SparseFisherYatesPermutation
 * @notice Sparse in-place Fisher-Yates style draw over the remaining range.
 * @dev Uses a sparse swap map to track the remaining draw state.
 */
contract SparseFisherYatesPermutation is PermutationBenchmarkBase {
    uint256 public remainingRange;
    mapping(uint256 => uint256) private swappedValues;

    constructor(uint256 _maxRange) PermutationBenchmarkBase(_maxRange) {
        remainingRange = _maxRange;
    }

    function getNextPermutedValue() public override returns (uint256) {
        _requireAvailable();

        uint256 sequenceIndex = permutationCounter;
        uint256 randomIndex = uint256(
            keccak256(
                abi.encodePacked(
                    block.prevrandao,
                    block.timestamp,
                    msg.sender,
                    sequenceIndex
                )
            )
        ) % remainingRange;

        uint256 selectedValue = swappedValues[randomIndex];
        if (selectedValue == 0) {
            selectedValue = randomIndex + 1;
        }

        uint256 lastIndex = remainingRange - 1;
        uint256 lastValue = swappedValues[lastIndex];
        if (lastValue == 0) {
            lastValue = lastIndex + 1;
        }

        if (randomIndex != lastIndex) {
            swappedValues[randomIndex] = lastValue;
        }

        delete swappedValues[lastIndex];
        remainingRange = lastIndex;

        return _consume(selectedValue);
    }
}
