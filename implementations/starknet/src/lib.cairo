use core::poseidon::poseidon_hash_span;
use starknet::{
    ContractAddress,
    get_block_number,
    get_block_timestamp,
    get_caller_address,
    get_contract_address,
    get_tx_info,
};
use core::traits::{Into, TryInto};

const DEFAULT_MAX_RANGE: u64 = 25_000;
const DEFAULT_MIN_EPOCH_SIZE: u64 = 250;
const DEFAULT_MAX_EPOCH_SIZE: u64 = 750;
const DEFAULT_EPOCH_ROUNDS: u8 = 1;
const DEFAULT_GLOBAL_ROUNDS: u8 = 3;
const GLOBAL_SCRAMBLE_LABEL: felt252 = 0x474c4f42414c5f534352414d424c45;

#[derive(Copy, Drop, Serde)]
pub struct EpochPermutationConfig {
    pub max_range: u64,
    pub min_epoch_size: u64,
    pub max_epoch_size: u64,
    pub epoch_rounds: u8,
    pub global_rounds: u8,
}

#[derive(Copy, Drop, Serde)]
pub struct DeploymentContext {
    pub timestamp: u64,
    pub deployer: felt252,
    pub chain_context: felt252,
    pub contract_context: felt252,
    pub block_number: u64,
}

#[derive(Copy, Drop, Serde)]
pub struct GenerationContext {
    pub randomness_beacon: felt252,
    pub timestamp: u64,
    pub caller: felt252,
}

#[derive(Copy, Drop, Serde)]
pub struct EpochInfo {
    pub epoch_number: u64,
    pub epoch_seed: felt252,
    pub position_in_epoch: u64,
    pub epoch_size: u64,
}

#[derive(Copy, Drop, Serde)]
pub struct Configuration {
    pub max_range: u64,
    pub min_epoch_size: u64,
    pub max_epoch_size: u64,
    pub epoch_size: u64,
    pub epoch_rounds: u8,
    pub global_rounds: u8,
}

#[derive(Copy, Drop, Serde, starknet::Store)]
pub struct EngineState {
    pub max_range: u64,
    pub min_epoch_size: u64,
    pub max_epoch_size: u64,
    pub epoch_size: u64,
    pub epoch_rounds: u8,
    pub global_rounds: u8,
    pub global_seed: felt252,
    pub current_epoch_seed: felt252,
    pub permutation_counter: u64,
}

#[starknet::interface]
pub trait IEpochPermutation<TContractState> {
    fn get_next_permuted_value(ref self: TContractState) -> u64;
    fn view_permutation(self: @TContractState, sequence_index: u64) -> u64;
    fn get_current_epoch_info(self: @TContractState) -> EpochInfo;
    fn get_configuration(self: @TContractState) -> Configuration;
}

#[starknet::contract]
mod EpochPermutationContract {
    use super::{
        Configuration, EngineState, EpochInfo, EpochPermutationConfig, IEpochPermutation,
        configuration_from_engine, current_generation_context, current_runtime_context,
        engine_current_epoch_info, engine_next_value, engine_view_value, new_engine,
    };
    use starknet::{
        get_block_number,
        storage::{StoragePointerReadAccess, StoragePointerWriteAccess},
    };

    #[storage]
    struct Storage {
        engine: EngineState,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        EpochSeedRotated: EpochSeedRotated,
        PermutationExecuted: PermutationExecuted,
    }

    #[derive(Drop, starknet::Event)]
    struct EpochSeedRotated {
        epoch_number: u64,
        new_seed: felt252,
        block_number: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct PermutationExecuted {
        sequence_index: u64,
        permuted_value: u64,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        max_range: u64,
        min_epoch_size: u64,
        max_epoch_size: u64,
        epoch_rounds: u8,
        global_rounds: u8,
    ) {
        let config = EpochPermutationConfig {
            max_range,
            min_epoch_size,
            max_epoch_size,
            epoch_rounds,
            global_rounds,
        };

        let deployment = current_runtime_context();
        let engine = new_engine(config, deployment);
        self.engine.write(engine);
    }

    #[abi(embed_v0)]
    impl EpochPermutationImpl of IEpochPermutation<ContractState> {
        fn get_next_permuted_value(ref self: ContractState) -> u64 {
            let mut engine = self.engine.read();
            let sequence_index = engine.permutation_counter;
            let should_rotate = sequence_index % engine.epoch_size == 0_u64;
            let value = engine_next_value(ref engine, current_generation_context());
            self.engine.write(engine);

            if should_rotate {
                self.emit(Event::EpochSeedRotated(EpochSeedRotated {
                    epoch_number: sequence_index / engine.epoch_size,
                    new_seed: engine.current_epoch_seed,
                    block_number: get_block_number(),
                }));
            }

            self.emit(Event::PermutationExecuted(PermutationExecuted {
                sequence_index,
                permuted_value: value,
            }));

            value
        }

        fn view_permutation(self: @ContractState, sequence_index: u64) -> u64 {
            engine_view_value(self.engine.read(), sequence_index)
        }

        fn get_current_epoch_info(self: @ContractState) -> EpochInfo {
            engine_current_epoch_info(self.engine.read())
        }

        fn get_configuration(self: @ContractState) -> Configuration {
            configuration_from_engine(self.engine.read())
        }
    }
}

fn new_engine(config: EpochPermutationConfig, deployment: DeploymentContext) -> EngineState {
    let max_range = default_u64(config.max_range, DEFAULT_MAX_RANGE);
    let min_epoch_size = default_u64(config.min_epoch_size, DEFAULT_MIN_EPOCH_SIZE);
    let max_epoch_size = default_u64(config.max_epoch_size, DEFAULT_MAX_EPOCH_SIZE);
    let epoch_rounds = default_u8(config.epoch_rounds, DEFAULT_EPOCH_ROUNDS);
    let global_rounds = default_u8(config.global_rounds, DEFAULT_GLOBAL_ROUNDS);

    assert(max_range > 0_u64, 'max_range');
    assert(min_epoch_size > 0_u64, 'min_epoch');
    assert(max_epoch_size >= min_epoch_size, 'epoch_rng');

    let epoch_size = derive_epoch_size(min_epoch_size, max_epoch_size, deployment);
    let global_seed = derive_global_seed(deployment);

    EngineState {
        max_range,
        min_epoch_size,
        max_epoch_size,
        epoch_size,
        epoch_rounds,
        global_rounds,
        global_seed,
        current_epoch_seed: 0,
        permutation_counter: 0,
    }
}

fn engine_next_value(ref engine: EngineState, generation: GenerationContext) -> u64 {
    assert(engine.permutation_counter < engine.max_range, 'exhausted');

    let sequence_index = engine.permutation_counter;
    let value = get_permuted_value(ref engine, sequence_index, generation);
    engine.permutation_counter = engine.permutation_counter + 1_u64;
    value
}

fn engine_view_value(engine: EngineState, sequence_index: u64) -> u64 {
    assert(sequence_index < engine.max_range, 'input_oob');
    let simulated_seed = simulate_epoch_seed(engine, sequence_index);
    compute_permutation(engine, sequence_index, simulated_seed)
}

fn engine_current_epoch_info(engine: EngineState) -> EpochInfo {
    EpochInfo {
        epoch_number: engine.permutation_counter / engine.epoch_size,
        epoch_seed: engine.current_epoch_seed,
        position_in_epoch: engine.permutation_counter % engine.epoch_size,
        epoch_size: engine.epoch_size,
    }
}

fn configuration_from_engine(engine: EngineState) -> Configuration {
    Configuration {
        max_range: engine.max_range,
        min_epoch_size: engine.min_epoch_size,
        max_epoch_size: engine.max_epoch_size,
        epoch_size: engine.epoch_size,
        epoch_rounds: engine.epoch_rounds,
        global_rounds: engine.global_rounds,
    }
}

fn current_runtime_context() -> DeploymentContext {
    let tx_info = get_tx_info().unbox();
    let contract_address: ContractAddress = get_contract_address();
    let caller_address: ContractAddress = get_caller_address();

    DeploymentContext {
        timestamp: get_block_timestamp(),
        deployer: caller_address.into(),
        chain_context: tx_info.chain_id,
        contract_context: contract_address.into(),
        block_number: get_block_number(),
    }
}

fn current_generation_context() -> GenerationContext {
    let tx_info = get_tx_info().unbox();
    let caller_address: ContractAddress = get_caller_address();
    let block_number = get_block_number();
    let timestamp = get_block_timestamp();

    let randomness_beacon = hash_values(
        array![
            block_number.into(),
            timestamp.into(),
            caller_address.into(),
            tx_info.chain_id,
        ]
            .span(),
    );

    GenerationContext {
        randomness_beacon,
        timestamp,
        caller: caller_address.into(),
    }
}

fn get_permuted_value(ref engine: EngineState, sequence_index: u64, generation: GenerationContext) -> u64 {
    if sequence_index % engine.epoch_size == 0_u64 {
        rotate_epoch_seed(ref engine, generation);
    }

    let engine_snapshot = EngineState {
        max_range: engine.max_range,
        min_epoch_size: engine.min_epoch_size,
        max_epoch_size: engine.max_epoch_size,
        epoch_size: engine.epoch_size,
        epoch_rounds: engine.epoch_rounds,
        global_rounds: engine.global_rounds,
        global_seed: engine.global_seed,
        current_epoch_seed: engine.current_epoch_seed,
        permutation_counter: engine.permutation_counter,
    };

    compute_permutation(engine_snapshot, sequence_index, engine.current_epoch_seed)
}

fn compute_permutation(engine: EngineState, sequence_index: u64, epoch_seed: felt252) -> u64 {
    let epoch_number = sequence_index / engine.epoch_size;
    let first_index_of_epoch = epoch_number * engine.epoch_size;
    let remaining_range = engine.max_range - first_index_of_epoch;
    let actual_epoch_size = min_u64(remaining_range, engine.epoch_size);
    let relative_index = sequence_index % engine.epoch_size;

    assert(relative_index < actual_epoch_size, 'epoch_oob');

    let epoch_permuted = feistel_permute(
        relative_index,
        epoch_seed,
        actual_epoch_size,
        engine.epoch_rounds,
    );

    let intermediate_value = first_index_of_epoch + epoch_permuted;
    let global_permuted = feistel_permute(
        intermediate_value,
        engine.global_seed,
        engine.max_range,
        engine.global_rounds,
    );

    global_permuted + 1_u64
}

fn rotate_epoch_seed(ref engine: EngineState, generation: GenerationContext) {
    let next_seed = hash_values(
        array![
            generation.randomness_beacon,
            generation.timestamp.into(),
            generation.caller,
            engine.current_epoch_seed,
        ]
            .span(),
    );

    engine.current_epoch_seed = if next_seed == 0 { 1 } else { next_seed };
}

fn simulate_epoch_seed(engine: EngineState, _sequence_index: u64) -> felt252 {
    engine.current_epoch_seed
}

fn feistel_permute(input: u64, seed: felt252, range: u64, rounds: u8) -> u64 {
    if range <= 1_u64 {
        return 0_u64;
    }

    let (a, b) = find_grid(range);
    let mut x = input;

    loop {
        let mut round = 0_u8;
        while round < rounds {
            let l = x / b;
            let r = x % b;
            let round_hash = hash_values(array![r.into(), seed, round.into()].span());
            let l_new = r;
            let r_new = (l + hash_mod_u64(round_hash, a)) % a;
            x = l_new * a + r_new;
            round = round + 1_u8;
        }

        if x < range {
            return x;
        }
    }
}

fn find_grid(range: u64) -> (u64, u64) {
    if range <= 1_u64 {
        return (1_u64, 1_u64);
    }

    let a = integer_sqrt(range - 1_u64) + 1_u64;
    let b = (range + a - 1_u64) / a;
    (a, b)
}

fn integer_sqrt(value: u64) -> u64 {
    if value <= 1_u64 {
        return value;
    }

    let mut x0 = value;
    let mut x1 = (x0 + value / x0) / 2_u64;

    while x1 < x0 {
        x0 = x1;
        x1 = (x0 + value / x0) / 2_u64;
    }

    x0
}

fn derive_epoch_size(min_epoch_size: u64, max_epoch_size: u64, deployment: DeploymentContext) -> u64 {
    let spread = max_epoch_size - min_epoch_size + 1_u64;
    let random = hash_values(
        array![
            deployment.timestamp.into(),
            deployment.deployer,
            deployment.chain_context,
        ]
            .span(),
    );

    min_epoch_size + hash_mod_u64(random, spread)
}

fn derive_global_seed(deployment: DeploymentContext) -> felt252 {
    hash_values(
        array![
            deployment.contract_context,
            deployment.block_number.into(),
            GLOBAL_SCRAMBLE_LABEL,
        ]
            .span(),
    )
}

fn hash_values(values: Span<felt252>) -> felt252 {
    poseidon_hash_span(values)
}

fn hash_mod_u64(hash: felt252, modulo: u64) -> u64 {
    if modulo == 0_u64 {
        return 0_u64;
    }

    let hash_u256: u256 = hash.try_into().unwrap();
    let reduced = hash_u256 % modulo.into();
    reduced.try_into().unwrap()
}

fn min_u64(a: u64, b: u64) -> u64 {
    if a < b { a } else { b }
}

fn default_u64(value: u64, fallback: u64) -> u64 {
    if value == 0_u64 { fallback } else { value }
}

fn default_u8(value: u8, fallback: u8) -> u8 {
    if value == 0_u8 { fallback } else { value }
}

#[cfg(test)]
mod tests {
    use super::{
        DeploymentContext, EngineState, EpochPermutationConfig, GenerationContext, engine_next_value,
        engine_view_value, new_engine,
    };
    use core::array::ArrayTrait;

    fn config(max_range: u64) -> EpochPermutationConfig {
        EpochPermutationConfig {
            max_range,
            min_epoch_size: 17_u64,
            max_epoch_size: 29_u64,
            epoch_rounds: 1_u8,
            global_rounds: 3_u8,
        }
    }

    fn deployment() -> DeploymentContext {
        DeploymentContext {
            timestamp: 1_700_000_000_u64,
            deployer: 11,
            chain_context: 22,
            contract_context: 33,
            block_number: 44_u64,
        }
    }

    fn generation(step: u64) -> GenerationContext {
        GenerationContext {
            randomness_beacon: (step + 100_u64).into(),
            timestamp: 1_700_000_000_u64 + step,
            caller: (step + 1_u64).into(),
        }
    }

    fn assert_no_duplicates(values: Span<u64>) {
        let mut i = 0;
        while i < values.len() {
            let mut j = i + 1;
            let current = *values.at(i);
            while j < values.len() {
                let candidate = *values.at(j);
                assert(current != candidate, 'duplicate');
                j += 1;
            }
            i += 1;
        }
    }

    #[test]
    fn engine_exhausts_small_range_without_duplicates() {
        let mut engine: EngineState = new_engine(config(128_u64), deployment());
        let mut outputs = array![];

        let mut step = 0_u64;
        while step < engine.max_range {
            let value = engine_next_value(ref engine, generation(step));
            outputs.append(value);
            step += 1_u64;
        }

        assert_no_duplicates(outputs.span());
    }

    #[test]
    fn engine_rotates_seed_on_first_generation() {
        let mut engine = new_engine(config(64_u64), deployment());
        assert(engine.current_epoch_seed == 0, 'seed_zero');

        let _ = engine_next_value(ref engine, generation(0_u64));

        assert(engine.current_epoch_seed != 0, 'seed_same');
        assert(engine.permutation_counter == 1_u64, 'counter');
    }

    #[test]
    fn view_returns_in_range_value() {
        let engine = new_engine(config(32_u64), deployment());
        let value = engine_view_value(engine, 31_u64);
        assert(value >= 1_u64, 'view_low');
        assert(value <= 32_u64, 'view_high');
    }

    #[test]
    fn view_prefix_is_unique() {
        let engine = new_engine(config(64_u64), deployment());
        let mut outputs = array![];
        let mut step = 0_u64;

        while step < 8_u64 {
            let value = engine_view_value(engine, step);
            assert(value >= 1_u64, 'view_low');
            assert(value <= 64_u64, 'view_high');
            outputs.append(value);
            step += 1_u64;
        }

        assert_no_duplicates(outputs.span());
    }

    #[test]
    #[should_panic(expected: ('exhausted',))]
    fn engine_panics_after_range_exhaustion() {
        let max_range = 16_u64;
        let mut engine = new_engine(config(max_range), deployment());
        let mut step = 0_u64;

        while step < max_range {
            let _ = engine_next_value(ref engine, generation(step));
            step += 1_u64;
        }

        let _ = engine_next_value(ref engine, generation(max_range));
    }
}
