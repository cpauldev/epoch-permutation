// SPDX-License-Identifier: MIT
pragma solidity 0.8.34;

import "@openzeppelin/contracts/utils/math/Math.sol";
import "./PermutationBenchmarkBase.sol";

/**
 * @title SingleStageFeistelPermutation
 * @notice Single-stage Feistel permutation over the full range.
 * @dev Serves as an ablation against the epoch-local + global structure.
 */
contract SingleStageFeistelPermutation is PermutationBenchmarkBase {
    uint8 public immutable GLOBAL_ROUNDS;
    uint256 private immutable GLOBAL_SEED;

    uint8 private constant DEFAULT_GLOBAL_ROUNDS = 3;

    constructor(
        uint256 _maxRange,
        uint8 _globalRounds
    ) PermutationBenchmarkBase(_maxRange) {
        GLOBAL_ROUNDS = _globalRounds == 0
            ? DEFAULT_GLOBAL_ROUNDS
            : _globalRounds;
        GLOBAL_SEED = uint256(
            keccak256(
                abi.encodePacked(
                    address(this),
                    block.number,
                    "SINGLE_STAGE_FEISTEL"
                )
            )
        );
    }

    function getNextPermutedValue() public override returns (uint256) {
        _requireAvailable();

        uint256 value = _feistelPermute(
            permutationCounter,
            GLOBAL_SEED,
            MAX_RANGE,
            GLOBAL_ROUNDS
        ) + 1;

        return _consume(value);
    }

    function getConfiguration()
        external
        view
        returns (uint256 maxRange, uint8 globalRounds)
    {
        maxRange = MAX_RANGE;
        globalRounds = GLOBAL_ROUNDS;
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
