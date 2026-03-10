// SPDX-License-Identifier: MIT
/**
 * @title Bounded Deterministic Hash-Seeded Feistel Network Permutation Algorithm
 * @notice Reference EVM implementation of a bounded non-repeating sequence generator.
 * @dev Applies an epoch-local Feistel permutation followed by a global Feistel permutation.
 * The design is intended for research and implementation review. It is not presented as a
 * cryptographic randomness primitive.
 */
pragma solidity 0.8.34;

import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title EpochPermutation
 * @notice Epoch Permutation Algorithm
 * @dev Implementation of the Bounded Deterministic Hash-Seeded Feistel Network Permutation
 */
contract EpochPermutation {
    // ============================================================================
    // STATE VARIABLES
    // ============================================================================

    /// @notice Maximum value in the permutation range (e.g., 25000 for a sequence of 25,000 values)
    uint256 public immutable MAX_RANGE;

    /// @notice Minimum epoch size (prevents too-frequent seed rotations)
    /// @dev Smaller = more entropy updates, higher gas cost
    uint256 public immutable MIN_EPOCH_SIZE;

    /// @notice Maximum epoch size (prevents too-infrequent seed rotations)
    /// @dev Larger = fewer entropy updates, lower gas cost
    uint256 public immutable MAX_EPOCH_SIZE;

    /// @notice Number of values per epoch (random size between MIN and MAX)
    /// @dev Randomly selected at deployment within [MIN_EPOCH_SIZE, MAX_EPOCH_SIZE]
    uint256 public immutable EPOCH_SIZE;

    /// @notice Number of Feistel rounds for epoch-level permutation
    /// @dev 1 round = visible patterns, 3+ rounds = appears random
    uint8 public immutable EPOCH_ROUNDS;

    /// @notice Number of Feistel rounds for global permutation
    /// @dev More rounds = stronger mixing but higher gas cost
    uint8 public immutable GLOBAL_ROUNDS;

    /// @notice Immutable global permutation seed (set at deployment)
    /// @dev This seed is used for the second-stage global permutation
    uint256 private immutable GLOBAL_SEED;

    /// @notice Current epoch seed (rotates every EPOCH_SIZE values)
    /// @dev This seed changes dynamically during execution
    uint256 private currentEpochSeed;

    /// @notice Counter tracking how many values have been permuted
    /// @dev Used to determine when to rotate epoch seed
    uint256 public permutationCounter;

    /// @notice Default maximum range (used when constructor param is 0)
    uint256 private constant DEFAULT_MAX_RANGE = 25000;

    /// @notice Default minimum epoch size (used when constructor param is 0)
    uint256 private constant DEFAULT_MIN_EPOCH_SIZE = 250;

    /// @notice Default maximum epoch size (used when constructor param is 0)
    uint256 private constant DEFAULT_MAX_EPOCH_SIZE = 750;

    /// @notice Default number of Feistel rounds for epoch-level permutation
    uint8 private constant DEFAULT_EPOCH_ROUNDS = 1;

    /// @notice Default number of Feistel rounds for global permutation
    uint8 private constant DEFAULT_GLOBAL_ROUNDS = 3;

    // ============================================================================
    // EVENTS
    // ============================================================================

    /// @notice Emitted when a new epoch seed is generated
    /// @param epochNumber The epoch number (sequential)
    /// @param newSeed The newly generated seed value
    /// @param blockNumber The block number where seed was generated
    event EpochSeedRotated(
        uint256 indexed epochNumber,
        uint256 newSeed,
        uint256 blockNumber
    );

    /// @notice Emitted when a permutation is executed
    /// @param sequenceIndex Input value (0 to MAX_RANGE-1)
    /// @param permutedValue Output value (1 to MAX_RANGE)
    event PermutationExecuted(
        uint256 indexed sequenceIndex,
        uint256 permutedValue
    );

    // ============================================================================
    // ERRORS
    // ============================================================================

    /// @dev Input exceeds maximum range
    error InputOutOfRange(uint256 input, uint256 maxRange);

    /// @dev All values in range have been permuted
    error RangeExhausted(uint256 attempted, uint256 maximum);

    // ============================================================================
    // CONSTRUCTOR
    // ============================================================================

    /**
     * @notice Initialize the permutation system
     * @param _maxRange The maximum value in the range (0 = use default: 25000)
     * @param _minEpochSize Minimum epoch size (0 = use default: 250)
     * @param _maxEpochSize Maximum epoch size (0 = use default: 750)
     * @param _epochRounds Number of Feistel rounds for epoch permutation (0 = use default: 1)
     * @param _globalRounds Number of Feistel rounds for global permutation (0 = use default: 3)
     * @dev Generates random epoch size between min/max and global seed at deployment
     * @dev Pass 0 for any parameter to use recommended defaults
     */
    constructor(
        uint256 _maxRange,
        uint256 _minEpochSize,
        uint256 _maxEpochSize,
        uint8 _epochRounds,
        uint8 _globalRounds
    ) {
        // Apply defaults when 0 is passed
        MAX_RANGE = _maxRange == 0 ? DEFAULT_MAX_RANGE : _maxRange;
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

        // Validate final values after defaults are applied
        require(MAX_RANGE > 0, "Max range must be positive");
        require(MIN_EPOCH_SIZE > 0, "Min epoch size must be positive");
        require(
            MAX_EPOCH_SIZE >= MIN_EPOCH_SIZE,
            "Max epoch size must be >= min"
        );

        // Generate pseudo-random epoch size between MIN_EPOCH_SIZE and MAX_EPOCH_SIZE
        // This prevents pre-deployment analysis (each deployment has unique epoch size)
        // Note: After deployment, EPOCH_SIZE is public and boundaries are calculable
        uint256 randomValue = uint256(
            keccak256(
                abi.encodePacked(block.timestamp, msg.sender, block.chainid)
            )
        );
        EPOCH_SIZE =
            (randomValue % (MAX_EPOCH_SIZE - MIN_EPOCH_SIZE + 1)) +
            MIN_EPOCH_SIZE;

        // Generate immutable global seed from deployment context
        GLOBAL_SEED = uint256(
            keccak256(
                abi.encodePacked(address(this), block.number, "GLOBAL_SCRAMBLE")
            )
        );

        // Epoch seed starts at 0, will be set on first permutation
        currentEpochSeed = 0;
    }

    // ============================================================================
    // PUBLIC FUNCTIONS
    // ============================================================================

    /**
     * @notice Get the next permuted value in sequence
     * @return permutedValue The permuted output value (1-indexed)
     * @dev This is the main entry point for sequential permutation
     */
    function getNextPermutedValue() public returns (uint256 permutedValue) {
        require(
            permutationCounter < MAX_RANGE,
            RangeExhausted(permutationCounter, MAX_RANGE)
        );

        permutedValue = _getPermutedValue(permutationCounter);
        permutationCounter++;

        emit PermutationExecuted(permutationCounter - 1, permutedValue);

        return permutedValue;
    }

    /**
     * @notice Get permuted value for specific sequence index (read-only)
     * @param _sequenceIndex Input value (0 to MAX_RANGE-1)
     * @return permutedValue The permuted output value (1 to MAX_RANGE)
     * @dev View helper that uses currently known epoch seed state.
     * It cannot predict future epoch seeds before they are generated on-chain.
     */
    function viewPermutation(
        uint256 _sequenceIndex
    ) public view returns (uint256 permutedValue) {
        require(
            _sequenceIndex < MAX_RANGE,
            InputOutOfRange(_sequenceIndex, MAX_RANGE)
        );

        return _simulatePermutation(_sequenceIndex);
    }

    // ============================================================================
    // INTERNAL FUNCTIONS - CORE ALGORITHM
    // ============================================================================

    /**
     * @notice Internal function to get permuted value with state updates
     * @param _sequenceIndex The sequential input (0 to MAX_RANGE-1)
     * @return The permuted output value (1 to MAX_RANGE, 1-indexed)
     */
    function _getPermutedValue(
        uint256 _sequenceIndex
    ) internal returns (uint256) {
        // Check if we've crossed into a new epoch
        if (_sequenceIndex % EPOCH_SIZE == 0) {
            _rotateEpochSeed(_sequenceIndex);
        }

        return _computePermutation(_sequenceIndex, currentEpochSeed);
    }

    /**
     * @notice View-only reconstruction of permutation using currently known seed state
     * @param _sequenceIndex The sequential input
     * @return The permuted output value
     */
    function _simulatePermutation(
        uint256 _sequenceIndex
    ) internal view returns (uint256) {
        // Simulate what the epoch seed would be at this point
        uint256 simulatedSeed = _simulateEpochSeed(_sequenceIndex);
        return _computePermutation(_sequenceIndex, simulatedSeed);
    }

    /**
     * @notice Core permutation computation
     * @param _sequenceIndex The sequential input (0 to MAX_RANGE-1)
     * @param _epochSeed The current epoch seed to use
     * @return The final permuted value (1 to MAX_RANGE, 1-indexed)
     */
    function _computePermutation(
        uint256 _sequenceIndex,
        uint256 _epochSeed
    ) internal view returns (uint256) {
        // === STEP 1: Determine epoch boundaries ===
        uint256 epochNumber = _sequenceIndex / EPOCH_SIZE;
        uint256 firstIndexOfEpoch = epochNumber * EPOCH_SIZE;

        // === STEP 2: Calculate actual epoch size ===
        // (last epoch may be smaller if MAX_RANGE not divisible by EPOCH_SIZE)
        uint256 remainingRange = MAX_RANGE - firstIndexOfEpoch;
        uint256 actualEpochSize = remainingRange < EPOCH_SIZE
            ? remainingRange
            : EPOCH_SIZE;

        // === STEP 3: Get relative position within epoch ===
        uint256 relativeIndex = _sequenceIndex % EPOCH_SIZE;
        require(
            relativeIndex < actualEpochSize,
            "Relative index exceeds epoch size"
        );

        // === STEP 4: First permutation - within epoch ===
        // Maps relativeIndex to a shuffled position within the epoch
        uint256 epochPermuted = _feistelPermute(
            relativeIndex,
            _epochSeed,
            actualEpochSize,
            EPOCH_ROUNDS
        );

        // Convert back to global range
        uint256 intermediateValue = epochPermuted + firstIndexOfEpoch;

        // === STEP 5: Second permutation - global shuffle ===
        // Maps the intermediate value across the entire range
        uint256 globalPermuted = _feistelPermute(
            intermediateValue,
            GLOBAL_SEED,
            MAX_RANGE,
            GLOBAL_ROUNDS
        );

        // === STEP 6: Convert to 1-indexed ===
        // (Common convention for 1-based sequences)
        return globalPermuted + 1;
    }

    /**
     * @notice Rotate the epoch seed to a new value
     * @param _sequenceIndex Current sequence position
     * @dev Called when crossing epoch boundaries
     */
    function _rotateEpochSeed(uint256 _sequenceIndex) internal {
        uint256 epochNumber = _sequenceIndex / EPOCH_SIZE;

        // Generate new seed from:
        // - Previous epoch seed (creates chain of entropy)
        // - block.prevrandao (Ethereum's beacon chain randomness)
        // - block.timestamp (temporal entropy)
        // - msg.sender (transaction-specific entropy)
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

        // Avoid seed of 0 (could reduce entropy)
        currentEpochSeed = (newSeed == 0) ? 1 : newSeed;

        emit EpochSeedRotated(epochNumber, currentEpochSeed, block.number);
    }

    /**
     * @notice Simulate what the epoch seed would be at a given index
     * @param _sequenceIndex The sequence index to simulate
     * @return The simulated epoch seed
     * @dev Used for view-only permutation queries.
     * Only the current epoch seed is known unless prior seeds are explicitly persisted.
     */
    function _simulateEpochSeed(
        uint256 _sequenceIndex
    ) internal view returns (uint256) {
        uint256 epochNumber = _sequenceIndex / EPOCH_SIZE;

        // If querying current epoch, return current seed
        uint256 currentEpoch = permutationCounter / EPOCH_SIZE;
        if (epochNumber == currentEpoch) {
            return currentEpochSeed;
        }

        // Cannot accurately simulate non-current epochs:
        // - Past epochs: Would need historical block data that's no longer in context
        // - Future epochs: Cannot predict future block data
        // Returns current seed as fallback (inaccurate for view-only queries)
        return currentEpochSeed;
    }

    // ============================================================================
    // PRIVATE FUNCTIONS - FEISTEL NETWORK
    // ============================================================================

    /**
     * @notice Feistel network permutation function
     * @dev Core permutation primitive using hash-based transformation
     *
     * @param _input The value to permute (0 to _range-1)
     * @param _seed Random seed for this permutation
     * @param _range The size of the permutation space
     * @param _rounds Number of Feistel rounds to execute
     * @return The permuted value (0 to _range-1)
     *
     * ## How It Works
     *
     * 1. **Grid Decomposition**
     *    The range is decomposed into a 2D grid of dimensions a × b:
     *    - a = ⌈√(range-1)⌉ + 1 (column count)
     *    - b = ⌈range / a⌉      (row count)
     *    - Total cells: a × b ≥ range
     *
     * 2. **Position Encoding**
     *    Each value is encoded as grid coordinates:
     *    - l = input ÷ b  (column index)
     *    - r = input mod b (row index)
     *
     * 3. **Feistel Rounds**
     *    For each round i:
     *    - h = hash(r, seed, i)
     *    - l_new = r
     *    - r_new = (l + h) mod a
     *    - Encode: output = l_new × a + r_new
     *
     * 4. **Cycle Walking**
     *    If output ≥ range, recursively permute until in range
     *    This maintains bijectivity while constraining to arbitrary ranges
     *
     * ## Example (range=10, rounds=3)
     *
     * Grid: a=4, b=3 (4×3=12 cells, ≥10)
     *
     * Input: 5
     * - Initial: l=1, r=2
     * - Round 1: h=hash(2,seed,0), l=2, r=(1+h)%4
     * - Round 2: h=hash(r,seed,1), l=r, r=(l+h)%4
     * - Round 3: h=hash(r,seed,2), l=r, r=(l+h)%4
     * - Output: l×4 + r
     * - If ≥10: recursively permute
     *
     * @dev Gas cost: O(rounds × log(range))
     */
    function _feistelPermute(
        uint256 _input,
        uint256 _seed,
        uint256 _range,
        uint8 _rounds
    ) private pure returns (uint256) {
        // Edge cases: empty or single-element range
        if (_range == 0) return 0;
        if (_range == 1) return 0;

        // === STEP 1: Grid decomposition ===
        // Calculate grid dimensions that contain the range
        // a = number of columns, b = number of rows
        uint256 a = 1;
        if (_range > 1) {
            // For ranges > 1, calculate optimal grid dimensions
            // a = ceiling(sqrt(range - 1)) + 1
            a = uint256(Math.sqrt(_range - 1)) + 1;
        }
        // b = ceiling(range / a) ensures a × b >= range
        uint256 b = (_range + a - 1) / a;

        // === STEP 2: Encode input as grid coordinates ===
        uint256 x = _input;

        // === STEP 3: Execute Feistel rounds ===
        for (uint8 i = 0; i < _rounds; i++) {
            // Decode current position
            uint256 l = x / b; // column
            uint256 r = x % b; // row

            // Generate round-specific hash
            bytes32 h = keccak256(abi.encodePacked(r, _seed, i));

            // Feistel transformation
            uint256 l_new = r;
            uint256 r_new = (l + uint256(h)) % a;

            // Encode new position
            x = l_new * a + r_new;
        }

        // === STEP 4: Cycle walking ===
        // If result is outside range, recursively permute
        // This is provably terminating and maintains bijectivity
        while (x >= _range) {
            x = _feistelPermute(x, _seed, _range, _rounds);
        }

        return x;
    }

    // ============================================================================
    // VIEW FUNCTIONS - FOR ANALYSIS
    // ============================================================================

    /**
     * @notice Get current epoch information
     * @return epochNumber Current epoch number
     * @return epochSeed Current epoch seed
     * @return positionInEpoch Current position within epoch
     * @return epochSize The configured epoch size
     */
    function getCurrentEpochInfo()
        external
        view
        returns (
            uint256 epochNumber,
            uint256 epochSeed,
            uint256 positionInEpoch,
            uint256 epochSize
        )
    {
        epochNumber = permutationCounter / EPOCH_SIZE;
        epochSeed = currentEpochSeed;
        positionInEpoch = permutationCounter % EPOCH_SIZE;
        epochSize = EPOCH_SIZE;
    }

    /**
     * @notice Get configuration parameters
     * @return maxRange Maximum permutation range
     * @return minEpochSize Minimum epoch size
     * @return maxEpochSize Maximum epoch size
     * @return epochSize Actual epoch size (randomly selected)
     * @return globalSeed Global permutation seed
     * @return epochRounds Rounds for epoch permutation
     * @return globalRounds Rounds for global permutation
     */
    function getConfiguration()
        external
        view
        returns (
            uint256 maxRange,
            uint256 minEpochSize,
            uint256 maxEpochSize,
            uint256 epochSize,
            uint256 globalSeed,
            uint8 epochRounds,
            uint8 globalRounds
        )
    {
        maxRange = MAX_RANGE;
        minEpochSize = MIN_EPOCH_SIZE;
        maxEpochSize = MAX_EPOCH_SIZE;
        epochSize = EPOCH_SIZE;
        globalSeed = GLOBAL_SEED;
        epochRounds = EPOCH_ROUNDS;
        globalRounds = GLOBAL_ROUNDS;
    }
}
