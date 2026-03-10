use borsh::{BorshDeserialize, BorshSerialize};
use epoch_permutation_core::{
    DeploymentEntropy, EpochInfo, EpochPermutation, EpochPermutationConfig, EpochPermutationError,
    GenerationEntropy,
};

/// Solana-oriented state container around the shared Epoch Permutation core.
///
/// This keeps the algorithm logic in `epoch-permutation-core` and adapts Solana
/// runtime values into the entropy surfaces the core requires.
///
/// Suggested bindings:
/// - `program_id`      -> current program id bytes
/// - `payer` / signer  -> transaction signer pubkey bytes
/// - `slot`            -> deployment or execution slot
/// - `recent_blockhash`-> epoch entropy beacon
/// - `unix_timestamp`  -> Clock sysvar timestamp
#[derive(Clone, Debug, PartialEq, Eq, BorshSerialize, BorshDeserialize)]
pub struct SolanaEpochPermutationAccount {
    pub engine: EpochPermutation,
}

impl SolanaEpochPermutationAccount {
    pub fn initialize(
        config: EpochPermutationConfig,
        program_id: [u8; 32],
        payer: [u8; 32],
        recent_blockhash: [u8; 32],
        slot: u64,
        unix_timestamp: i64,
    ) -> Result<Self, EpochPermutationError> {
        let deployment = DeploymentEntropy {
            timestamp: unix_timestamp.max(0) as u64,
            deployer: payer,
            chain_context: recent_blockhash,
            contract_context: program_id,
            height: slot,
        };

        Ok(Self {
            engine: EpochPermutation::new(config, &deployment)?,
        })
    }

    pub fn next_value(
        &mut self,
        recent_blockhash: [u8; 32],
        signer: [u8; 32],
        unix_timestamp: i64,
    ) -> Result<u64, EpochPermutationError> {
        let entropy = GenerationEntropy {
            randomness_beacon: recent_blockhash,
            timestamp: unix_timestamp.max(0) as u64,
            caller: signer,
        };

        self.engine.next_value(&entropy)
    }

    pub fn view_value(&self, sequence_index: u64) -> Result<u64, EpochPermutationError> {
        self.engine.view_value(sequence_index)
    }

    pub fn current_epoch_info(&self) -> EpochInfo {
        self.engine.current_epoch_info()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    fn config(max_range: u64) -> EpochPermutationConfig {
        EpochPermutationConfig {
            max_range,
            min_epoch_size: 17,
            max_epoch_size: 29,
            epoch_rounds: 1,
            global_rounds: 3,
        }
    }

    fn blockhash(step: u64) -> [u8; 32] {
        let mut bytes = [0u8; 32];
        bytes[24..].copy_from_slice(&step.to_be_bytes());
        bytes
    }

    #[test]
    fn solana_adapter_exhausts_without_duplicates() {
        let mut account = SolanaEpochPermutationAccount::initialize(
            config(25_000),
            [7u8; 32],
            [9u8; 32],
            blockhash(0),
            1,
            1_700_000_000,
        )
        .unwrap();
        let max_range = account.engine.max_range;
        let mut seen = HashSet::with_capacity(max_range as usize);

        for step in 0..max_range {
            let value = account
                .next_value(blockhash(step + 1), [step as u8; 32], 1_700_000_000 + step as i64)
                .unwrap();
            assert!(seen.insert(value), "duplicate value generated: {value}");
        }

        assert_eq!(seen.len() as u64, max_range);
    }

    #[test]
    fn solana_adapter_reports_range_exhaustion_after_last_value() {
        let max_range = 16;
        let mut account = SolanaEpochPermutationAccount::initialize(
            config(max_range),
            [7u8; 32],
            [9u8; 32],
            blockhash(0),
            1,
            1_700_000_000,
        )
        .unwrap();

        for step in 0..max_range {
            account
                .next_value(blockhash(step + 1), [step as u8; 32], 1_700_000_000 + step as i64)
                .unwrap();
        }

        assert!(matches!(
            account.next_value(blockhash(max_range + 1), [0u8; 32], 1_700_000_000),
            Err(EpochPermutationError::RangeExhausted { .. })
        ));
    }

    #[test]
    fn solana_adapter_rotates_seed_on_first_generation() {
        let mut account = SolanaEpochPermutationAccount::initialize(
            config(64),
            [7u8; 32],
            [9u8; 32],
            blockhash(0),
            1,
            1_700_000_000,
        )
        .unwrap();

        assert_eq!(account.engine.permutation_counter, 0);
        assert_eq!(account.engine.current_epoch_seed, [0u8; 32]);

        let value = account
            .next_value(blockhash(1), [3u8; 32], 1_700_000_000)
            .unwrap();

        assert!((1..=64).contains(&value));
        assert_eq!(account.engine.permutation_counter, 1);
        assert_ne!(account.engine.current_epoch_seed, [0u8; 32]);
    }

    #[test]
    fn solana_adapter_view_prefix_is_unique_and_in_range() {
        let account = SolanaEpochPermutationAccount::initialize(
            config(64),
            [7u8; 32],
            [9u8; 32],
            blockhash(0),
            1,
            1_700_000_000,
        )
        .unwrap();
        let mut seen = HashSet::new();

        for sequence_index in 0..8 {
            let value = account.view_value(sequence_index).unwrap();
            assert!((1..=64).contains(&value));
            assert!(seen.insert(value), "duplicate value generated: {value}");
        }
    }

    #[test]
    fn solana_adapter_rejects_out_of_range_view_requests() {
        let account = SolanaEpochPermutationAccount::initialize(
            config(64),
            [7u8; 32],
            [9u8; 32],
            blockhash(0),
            1,
            1_700_000_000,
        )
        .unwrap();

        assert!(matches!(
            account.view_value(64),
            Err(EpochPermutationError::InputOutOfRange { .. })
        ));
    }
}
