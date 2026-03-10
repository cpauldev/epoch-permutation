use primitive_types::U256;
use sha3::{Digest, Keccak256};
use std::fmt;

pub const DEFAULT_MAX_RANGE: u64 = 25_000;
pub const DEFAULT_MIN_EPOCH_SIZE: u64 = 250;
pub const DEFAULT_MAX_EPOCH_SIZE: u64 = 750;
pub const DEFAULT_EPOCH_ROUNDS: u8 = 1;
pub const DEFAULT_GLOBAL_ROUNDS: u8 = 3;
pub const GLOBAL_SCRAMBLE_LABEL: &[u8] = b"GLOBAL_SCRAMBLE";

pub type Seed = [u8; 32];

#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
#[cfg_attr(feature = "borsh", derive(borsh::BorshSerialize, borsh::BorshDeserialize))]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct EpochPermutationConfig {
    pub max_range: u64,
    pub min_epoch_size: u64,
    pub max_epoch_size: u64,
    pub epoch_rounds: u8,
    pub global_rounds: u8,
}

impl Default for EpochPermutationConfig {
    fn default() -> Self {
        Self {
            max_range: DEFAULT_MAX_RANGE,
            min_epoch_size: DEFAULT_MIN_EPOCH_SIZE,
            max_epoch_size: DEFAULT_MAX_EPOCH_SIZE,
            epoch_rounds: DEFAULT_EPOCH_ROUNDS,
            global_rounds: DEFAULT_GLOBAL_ROUNDS,
        }
    }
}

#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
#[cfg_attr(feature = "borsh", derive(borsh::BorshSerialize, borsh::BorshDeserialize))]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DeploymentEntropy {
    pub timestamp: u64,
    pub deployer: [u8; 32],
    pub chain_context: [u8; 32],
    pub contract_context: [u8; 32],
    pub height: u64,
}

#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
#[cfg_attr(feature = "borsh", derive(borsh::BorshSerialize, borsh::BorshDeserialize))]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct GenerationEntropy {
    pub randomness_beacon: [u8; 32],
    pub timestamp: u64,
    pub caller: [u8; 32],
}

#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
#[cfg_attr(feature = "borsh", derive(borsh::BorshSerialize, borsh::BorshDeserialize))]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct EpochInfo {
    pub epoch_number: u64,
    pub epoch_seed: Seed,
    pub position_in_epoch: u64,
    pub epoch_size: u64,
}

#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
#[cfg_attr(feature = "borsh", derive(borsh::BorshSerialize, borsh::BorshDeserialize))]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct EpochPermutation {
    pub max_range: u64,
    pub min_epoch_size: u64,
    pub max_epoch_size: u64,
    pub epoch_size: u64,
    pub epoch_rounds: u8,
    pub global_rounds: u8,
    pub global_seed: Seed,
    pub current_epoch_seed: Seed,
    pub permutation_counter: u64,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum EpochPermutationError {
    InvalidRange,
    InvalidEpochBounds,
    InputOutOfRange { input: u64, max_range: u64 },
    RangeExhausted { attempted: u64, maximum: u64 },
}

impl fmt::Display for EpochPermutationError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidRange => write!(f, "max range must be positive"),
            Self::InvalidEpochBounds => write!(f, "max epoch size must be greater than or equal to min epoch size"),
            Self::InputOutOfRange { input, max_range } => {
                write!(f, "input {input} out of range (max {})", max_range.saturating_sub(1))
            }
            Self::RangeExhausted { attempted, maximum } => {
                write!(f, "range exhausted ({attempted}/{maximum})")
            }
        }
    }
}

impl std::error::Error for EpochPermutationError {}

impl EpochPermutation {
    pub fn new(
        config: EpochPermutationConfig,
        entropy: &DeploymentEntropy,
    ) -> Result<Self, EpochPermutationError> {
        let max_range = default_u64(config.max_range, DEFAULT_MAX_RANGE);
        let min_epoch_size = default_u64(config.min_epoch_size, DEFAULT_MIN_EPOCH_SIZE);
        let max_epoch_size = default_u64(config.max_epoch_size, DEFAULT_MAX_EPOCH_SIZE);
        let epoch_rounds = default_u8(config.epoch_rounds, DEFAULT_EPOCH_ROUNDS);
        let global_rounds = default_u8(config.global_rounds, DEFAULT_GLOBAL_ROUNDS);

        if max_range == 0 {
            return Err(EpochPermutationError::InvalidRange);
        }

        if min_epoch_size == 0 || max_epoch_size < min_epoch_size {
            return Err(EpochPermutationError::InvalidEpochBounds);
        }

        let epoch_size = derive_epoch_size(min_epoch_size, max_epoch_size, entropy);
        let global_seed = derive_global_seed(entropy);

        Ok(Self {
            max_range,
            min_epoch_size,
            max_epoch_size,
            epoch_size,
            epoch_rounds,
            global_rounds,
            global_seed,
            current_epoch_seed: [0u8; 32],
            permutation_counter: 0,
        })
    }

    pub fn next_value(
        &mut self,
        entropy: &GenerationEntropy,
    ) -> Result<u64, EpochPermutationError> {
        if self.permutation_counter >= self.max_range {
            return Err(EpochPermutationError::RangeExhausted {
                attempted: self.permutation_counter,
                maximum: self.max_range,
            });
        }

        let sequence_index = self.permutation_counter;
        let value = self.get_permuted_value(sequence_index, entropy);
        self.permutation_counter += 1;
        Ok(value)
    }

    pub fn view_value(&self, sequence_index: u64) -> Result<u64, EpochPermutationError> {
        if sequence_index >= self.max_range {
            return Err(EpochPermutationError::InputOutOfRange {
                input: sequence_index,
                max_range: self.max_range,
            });
        }

        let simulated_seed = self.simulate_epoch_seed(sequence_index);
        Ok(self.compute_permutation(sequence_index, &simulated_seed))
    }

    pub fn current_epoch_info(&self) -> EpochInfo {
        EpochInfo {
            epoch_number: self.permutation_counter / self.epoch_size,
            epoch_seed: self.current_epoch_seed,
            position_in_epoch: self.permutation_counter % self.epoch_size,
            epoch_size: self.epoch_size,
        }
    }

    fn get_permuted_value(
        &mut self,
        sequence_index: u64,
        entropy: &GenerationEntropy,
    ) -> u64 {
        if sequence_index % self.epoch_size == 0 {
            self.rotate_epoch_seed(entropy);
        }

        self.compute_permutation(sequence_index, &self.current_epoch_seed)
    }

    fn compute_permutation(&self, sequence_index: u64, epoch_seed: &Seed) -> u64 {
        let epoch_number = sequence_index / self.epoch_size;
        let first_index_of_epoch = epoch_number * self.epoch_size;
        let remaining_range = self.max_range - first_index_of_epoch;
        let actual_epoch_size = remaining_range.min(self.epoch_size);
        let relative_index = sequence_index % self.epoch_size;

        let epoch_permuted = feistel_permute(
            relative_index,
            epoch_seed,
            actual_epoch_size,
            self.epoch_rounds,
        );

        let intermediate_value = first_index_of_epoch + epoch_permuted;
        let global_permuted = feistel_permute(
            intermediate_value,
            &self.global_seed,
            self.max_range,
            self.global_rounds,
        );

        global_permuted + 1
    }

    fn rotate_epoch_seed(&mut self, entropy: &GenerationEntropy) {
        let next_seed = keccak_bytes(&[
            &entropy.randomness_beacon,
            &u64_to_word(entropy.timestamp),
            &entropy.caller,
            &self.current_epoch_seed,
        ]);

        self.current_epoch_seed = if is_zero_seed(&next_seed) {
            seed_from_u8(1)
        } else {
            next_seed
        };
    }

    fn simulate_epoch_seed(&self, sequence_index: u64) -> Seed {
        let epoch_number = sequence_index / self.epoch_size;
        let current_epoch = self.permutation_counter / self.epoch_size;

        if epoch_number == current_epoch {
            self.current_epoch_seed
        } else {
            self.current_epoch_seed
        }
    }
}

pub fn keccak_bytes(parts: &[&[u8]]) -> Seed {
    let mut hasher = Keccak256::new();
    for part in parts {
        hasher.update(part);
    }

    let digest = hasher.finalize();
    let mut bytes = [0u8; 32];
    bytes.copy_from_slice(&digest);
    bytes
}

pub fn fingerprint32(input: &[u8]) -> [u8; 32] {
    keccak_bytes(&[input])
}

pub fn u64_to_word(value: u64) -> [u8; 32] {
    let mut bytes = [0u8; 32];
    bytes[24..].copy_from_slice(&value.to_be_bytes());
    bytes
}

fn feistel_permute(input: u64, seed: &Seed, range: u64, rounds: u8) -> u64 {
    if range <= 1 {
        return 0;
    }

    let (a, b) = find_grid(range);
    let mut x = input;

    loop {
        for round in 0..rounds {
            let l = x / b;
            let r = x % b;
            let round_hash = keccak_bytes(&[&u64_to_word(r), seed, &[round]]);
            let l_new = r;
            let r_new = (l + hash_mod_u64(&round_hash, a)) % a;
            x = l_new * a + r_new;
        }

        if x < range {
            return x;
        }
    }
}

fn find_grid(range: u64) -> (u64, u64) {
    if range <= 1 {
        return (1, 1);
    }

    let a = integer_sqrt(range - 1) + 1;
    let b = (range + a - 1) / a;
    (a, b)
}

fn integer_sqrt(value: u64) -> u64 {
    if value <= 1 {
        return value;
    }

    let mut x0 = value;
    let mut x1 = (x0 + value / x0) / 2;

    while x1 < x0 {
        x0 = x1;
        x1 = (x0 + value / x0) / 2;
    }

    x0
}

fn hash_mod_u64(hash: &Seed, modulo: u64) -> u64 {
    if modulo == 0 {
        return 0;
    }

    let value = U256::from_big_endian(hash);
    (value % U256::from(modulo)).low_u64()
}

fn derive_epoch_size(min_epoch_size: u64, max_epoch_size: u64, entropy: &DeploymentEntropy) -> u64 {
    let spread = max_epoch_size - min_epoch_size + 1;
    let random = keccak_bytes(&[
        &u64_to_word(entropy.timestamp),
        &entropy.deployer,
        &entropy.chain_context,
    ]);

    min_epoch_size + hash_mod_u64(&random, spread)
}

fn derive_global_seed(entropy: &DeploymentEntropy) -> Seed {
    keccak_bytes(&[
        &entropy.contract_context,
        &u64_to_word(entropy.height),
        GLOBAL_SCRAMBLE_LABEL,
    ])
}

fn is_zero_seed(seed: &Seed) -> bool {
    seed.iter().all(|byte| *byte == 0)
}

fn seed_from_u8(value: u8) -> Seed {
    let mut seed = [0u8; 32];
    seed[31] = value;
    seed
}

fn default_u64(value: u64, fallback: u64) -> u64 {
    if value == 0 { fallback } else { value }
}

fn default_u8(value: u8, fallback: u8) -> u8 {
    if value == 0 { fallback } else { value }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    fn test_config(max_range: u64) -> EpochPermutationConfig {
        EpochPermutationConfig {
            max_range,
            min_epoch_size: 17,
            max_epoch_size: 29,
            epoch_rounds: 1,
            global_rounds: 3,
        }
    }

    fn deployment_entropy() -> DeploymentEntropy {
        DeploymentEntropy {
            timestamp: 1_700_000_000,
            deployer: fingerprint32(b"core-deployer"),
            chain_context: fingerprint32(b"core-chain"),
            contract_context: fingerprint32(b"core-contract"),
            height: 42,
        }
    }

    fn generation_entropy(step: u64) -> GenerationEntropy {
        GenerationEntropy {
            randomness_beacon: keccak_bytes(&[b"core-run", &u64_to_word(step)]),
            timestamp: 1_700_000_000 + step,
            caller: fingerprint32(&u64_to_word(step + 1)),
        }
    }

    #[test]
    fn exhausts_full_default_range_without_duplicates() {
        let max_range = DEFAULT_MAX_RANGE;
        let mut engine =
            EpochPermutation::new(test_config(max_range), &deployment_entropy()).unwrap();
        let mut seen = HashSet::with_capacity(max_range as usize);

        for step in 0..max_range {
            let value = engine.next_value(&generation_entropy(step)).unwrap();
            assert!((1..=max_range).contains(&value));
            assert!(seen.insert(value), "duplicate value generated: {value}");
        }

        assert_eq!(seen.len() as u64, max_range);
    }

    #[test]
    fn reports_range_exhaustion_after_last_value() {
        let max_range = 16;
        let mut engine =
            EpochPermutation::new(test_config(max_range), &deployment_entropy()).unwrap();

        for step in 0..max_range {
            engine.next_value(&generation_entropy(step)).unwrap();
        }

        assert!(matches!(
            engine.next_value(&generation_entropy(max_range)),
            Err(EpochPermutationError::RangeExhausted {
                attempted,
                maximum,
            }) if attempted == max_range && maximum == max_range
        ));
    }

    #[test]
    fn rotates_seed_on_first_generation() {
        let mut engine =
            EpochPermutation::new(EpochPermutationConfig::default(), &deployment_entropy()).unwrap();
        assert!(is_zero_seed(&engine.current_epoch_seed));

        let _ = engine.next_value(&generation_entropy(0)).unwrap();

        assert!(!is_zero_seed(&engine.current_epoch_seed));
        assert_eq!(engine.permutation_counter, 1);
    }

    #[test]
    fn view_prefix_is_unique_and_in_range() {
        let engine = EpochPermutation::new(test_config(128), &deployment_entropy()).unwrap();
        let mut seen = HashSet::new();

        for sequence_index in 0..16 {
            let value = engine.view_value(sequence_index).unwrap();
            assert!((1..=128).contains(&value));
            assert!(seen.insert(value), "duplicate view value generated: {value}");
        }
    }

    #[test]
    fn rejects_view_requests_outside_the_range() {
        let engine = EpochPermutation::new(test_config(128), &deployment_entropy()).unwrap();
        assert!(matches!(
            engine.view_value(128),
            Err(EpochPermutationError::InputOutOfRange { .. })
        ));
    }
}
