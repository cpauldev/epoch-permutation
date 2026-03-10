// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

interface IPermutationGenerator {
    function MAX_RANGE() external view returns (uint256);

    function permutationCounter() external view returns (uint256);

    function getNextPermutedValue() external returns (uint256);
}

/**
 * @title PermutationBatchHarness
 * @notice Stable caller and duplicate-checking verifier for stateful permutation contracts.
 * @dev Routes every generation call through one contract address so msg.sender-sensitive
 * generators produce one canonical sequence regardless of which EOA submits the batch tx.
 */
contract PermutationBatchHarness {
    IPermutationGenerator public immutable TARGET;
    uint256 public immutable MAX_RANGE;
    bool public immutable TRACK_COVERAGE;

    uint256 public processedCount;
    uint256 public duplicateCount;
    uint256 public batchCount;
    bool public firstDuplicateRecorded;
    uint256 public firstDuplicateValue;
    uint256 public firstDuplicateSequenceIndex;

    mapping(uint256 => uint256) private seenWords;

    error InvalidTarget(address target);
    error TargetAlreadyStarted(uint256 currentCount);
    error OutputOutOfRange(uint256 value, uint256 maxRange);

    event BatchProcessed(
        uint256 indexed batchNumber,
        uint256 indexed processedCount,
        uint256 stepsRequested,
        uint256 stepsExecuted,
        uint256 duplicateCount,
        bool complete
    );
    event DuplicateDetected(
        uint256 indexed sequenceIndex,
        uint256 indexed permutedValue,
        uint256 duplicateCount
    );

    constructor(address target, bool trackCoverage) {
        if (target == address(0)) {
            revert InvalidTarget(target);
        }

        TARGET = IPermutationGenerator(target);
        MAX_RANGE = TARGET.MAX_RANGE();
        TRACK_COVERAGE = trackCoverage;

        uint256 currentCount = TARGET.permutationCounter();
        if (currentCount != 0) {
            revert TargetAlreadyStarted(currentCount);
        }
    }

    function runBatch(uint256 steps) external returns (uint256 stepsExecuted) {
        uint256 remaining = MAX_RANGE - processedCount;
        stepsExecuted = steps < remaining ? steps : remaining;

        if (stepsExecuted == 0) {
            return 0;
        }

        for (uint256 index = 0; index < stepsExecuted; ) {
            uint256 sequenceIndex = processedCount;
            uint256 value = TARGET.getNextPermutedValue();

            if (value == 0 || value > MAX_RANGE) {
                revert OutputOutOfRange(value, MAX_RANGE);
            }

            if (TRACK_COVERAGE) {
                _recordCoverage(sequenceIndex, value);
            }

            processedCount = sequenceIndex + 1;

            unchecked {
                index++;
            }
        }

        batchCount += 1;
        emit BatchProcessed(
            batchCount,
            processedCount,
            steps,
            stepsExecuted,
            duplicateCount,
            processedCount == MAX_RANGE
        );
    }

    function uniqueCount() external view returns (uint256) {
        return processedCount - duplicateCount;
    }

    function remainingCount() external view returns (uint256) {
        return MAX_RANGE - processedCount;
    }

    function hasDuplicates() external view returns (bool) {
        return duplicateCount > 0;
    }

    function isComplete() external view returns (bool) {
        return processedCount == MAX_RANGE;
    }

    function wordCount() external view returns (uint256) {
        return (MAX_RANGE + 255) / 256;
    }

    function bitmapWord(uint256 wordIndex) external view returns (uint256) {
        return TRACK_COVERAGE ? seenWords[wordIndex] : 0;
    }

    function seen(uint256 value) external view returns (bool) {
        if (!TRACK_COVERAGE || value == 0 || value > MAX_RANGE) {
            return false;
        }

        uint256 zeroBased = value - 1;
        uint256 wordIndex = zeroBased >> 8;
        uint256 bitIndex = zeroBased & 255;
        uint256 mask = uint256(1) << bitIndex;

        return (seenWords[wordIndex] & mask) != 0;
    }

    function getStatus()
        external
        view
        returns (
            address target,
            uint256 maxRange,
            uint256 processed,
            uint256 duplicates,
            uint256 remaining,
            bool complete,
            bool hasDuplicate,
            bool trackCoverage
        )
    {
        target = address(TARGET);
        maxRange = MAX_RANGE;
        processed = processedCount;
        duplicates = duplicateCount;
        remaining = MAX_RANGE - processedCount;
        complete = processedCount == MAX_RANGE;
        hasDuplicate = duplicateCount > 0;
        trackCoverage = TRACK_COVERAGE;
    }

    function _recordCoverage(uint256 sequenceIndex, uint256 value) internal {
        uint256 zeroBased = value - 1;
        uint256 wordIndex = zeroBased >> 8;
        uint256 bitIndex = zeroBased & 255;
        uint256 mask = uint256(1) << bitIndex;
        uint256 word = seenWords[wordIndex];

        if ((word & mask) != 0) {
            duplicateCount += 1;

            if (!firstDuplicateRecorded) {
                firstDuplicateRecorded = true;
                firstDuplicateValue = value;
                firstDuplicateSequenceIndex = sequenceIndex;
            }

            emit DuplicateDetected(sequenceIndex, value, duplicateCount);
            return;
        }

        seenWords[wordIndex] = word | mask;
    }
}
