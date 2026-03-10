// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import "@openzeppelin/contracts/utils/math/Math.sol";
import "./PermutationBenchmarkBase.sol";

/**
 * @title EpochPermutationBenchmark
 * @notice Benchmark-oriented epoch permutation variant with a single shared event surface.
 * @dev Executes the epoch-based stateful generation flow with a compact event surface
 * for consistent benchmark instrumentation.
 */
contract EpochPermutationBenchmark is PermutationBenchmarkBase {
    uint256 public immutable MIN_EPOCH_SIZE;
    uint256 public immutable MAX_EPOCH_SIZE;
    uint256 public immutable EPOCH_SIZE;
    uint8 public immutable EPOCH_ROUNDS;
    uint8 public immutable GLOBAL_ROUNDS;

    uint256 private immutable GLOBAL_SEED;
    uint256 private currentEpochSeed;

    uint256 private constant DEFAULT_MIN_EPOCH_SIZE = 250;
    uint256 private constant DEFAULT_MAX_EPOCH_SIZE = 750;
    uint8 private constant DEFAULT_EPOCH_ROUNDS = 1;
    uint8 private constant DEFAULT_GLOBAL_ROUNDS = 3;

    error InvalidEpochBounds(uint256 minEpochSize, uint256 maxEpochSize);

    constructor(
        uint256 _maxRange,
        uint256 _minEpochSize,
        uint256 _maxEpochSize,
        uint8 _epochRounds,
        uint8 _globalRounds
    ) PermutationBenchmarkBase(_maxRange) {
        MIN_EPOCH_SIZE = _minEpochSize == 0
            ? DEFAULT_MIN_EPOCH_SIZE
            : _minEpochSize;
        MAX_EPOCH_SIZE = _maxEpochSize == 0
            ? DEFAULT_MAX_EPOCH_SIZE
            : _maxEpochSize;
        EPOCH_ROUNDS = _epochRounds == 0 ? DEFAULT_EPOCH_ROUNDS : _epochRounds;
        GLOBAL_ROUNDS = _globalRounds == 0
            ? DEFAULT_GLOBAL_ROUNDS
            : _globalRounds;

        if (MAX_EPOCH_SIZE < MIN_EPOCH_SIZE) {
            revert InvalidEpochBounds(MIN_EPOCH_SIZE, MAX_EPOCH_SIZE);
        }

        uint256 randomValue = uint256(
            keccak256(
                abi.encodePacked(block.timestamp, msg.sender, block.chainid)
            )
        );
        EPOCH_SIZE =
            (randomValue % (MAX_EPOCH_SIZE - MIN_EPOCH_SIZE + 1)) +
            MIN_EPOCH_SIZE;

        GLOBAL_SEED = uint256(
            keccak256(
                abi.encodePacked(address(this), block.number, "GLOBAL_SCRAMBLE")
            )
        );
        currentEpochSeed = 0;
    }

    function getNextPermutedValue() public override returns (uint256) {
        _requireAvailable();

        uint256 value = _getPermutedValue(permutationCounter);
        return _consume(value);
    }

    function getConfiguration()
        external
        view
        returns (
            uint256 maxRange,
            uint256 minEpochSize,
            uint256 maxEpochSize,
            uint256 epochSize,
            uint8 epochRounds,
            uint8 globalRounds
        )
    {
        maxRange = MAX_RANGE;
        minEpochSize = MIN_EPOCH_SIZE;
        maxEpochSize = MAX_EPOCH_SIZE;
        epochSize = EPOCH_SIZE;
        epochRounds = EPOCH_ROUNDS;
        globalRounds = GLOBAL_ROUNDS;
    }

    function _getPermutedValue(
        uint256 _sequenceIndex
    ) internal returns (uint256) {
        if (_sequenceIndex % EPOCH_SIZE == 0) {
            _rotateEpochSeed();
        }

        return _computePermutation(_sequenceIndex, currentEpochSeed);
    }

    function _computePermutation(
        uint256 _sequenceIndex,
        uint256 _epochSeed
    ) internal view returns (uint256) {
        uint256 epochNumber = _sequenceIndex / EPOCH_SIZE;
        uint256 firstIndexOfEpoch = epochNumber * EPOCH_SIZE;

        uint256 remainingRange = MAX_RANGE - firstIndexOfEpoch;
        uint256 actualEpochSize = remainingRange < EPOCH_SIZE
            ? remainingRange
            : EPOCH_SIZE;

        uint256 relativeIndex = _sequenceIndex % EPOCH_SIZE;
        require(
            relativeIndex < actualEpochSize,
            "Relative index exceeds epoch size"
        );

        uint256 epochPermuted = _feistelPermute(
            relativeIndex,
            _epochSeed,
            actualEpochSize,
            EPOCH_ROUNDS
        );

        uint256 intermediateValue = epochPermuted + firstIndexOfEpoch;

        uint256 globalPermuted = _feistelPermute(
            intermediateValue,
            GLOBAL_SEED,
            MAX_RANGE,
            GLOBAL_ROUNDS
        );

        return globalPermuted + 1;
    }

    function _rotateEpochSeed() internal {
        uint256 newSeed = uint256(
            keccak256(
                abi.encodePacked(
                    block.prevrandao,
                    block.timestamp,
                    msg.sender,
                    currentEpochSeed
                )
            )
        );

        currentEpochSeed = newSeed == 0 ? 1 : newSeed;
    }

    function _feistelPermute(
        uint256 _input,
        uint256 _seed,
        uint256 _range,
        uint8 _rounds
    ) private pure returns (uint256) {
        if (_range == 0 || _range == 1) {
            return 0;
        }

        uint256 a = 1;
        if (_range > 1) {
            a = uint256(Math.sqrt(_range - 1)) + 1;
        }
        uint256 b = (_range + a - 1) / a;

        uint256 x = _input;

        for (uint8 i = 0; i < _rounds; i++) {
            uint256 l = x / b;
            uint256 r = x % b;

            bytes32 h = keccak256(abi.encodePacked(r, _seed, i));
            uint256 lNew = r;
            uint256 rNew = (l + uint256(h)) % a;

            x = lNew * a + rNew;
        }

        while (x >= _range) {
            x = _feistelPermute(x, _seed, _range, _rounds);
        }

        return x;
    }
}
