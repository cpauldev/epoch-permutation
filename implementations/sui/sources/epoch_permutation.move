module epoch_permutation::epoch_permutation {
    use std::bcs;
    use std::hash;

    const DEFAULT_MAX_RANGE: u64 = 25000;
    const DEFAULT_MIN_EPOCH_SIZE: u64 = 250;
    const DEFAULT_MAX_EPOCH_SIZE: u64 = 750;
    const DEFAULT_EPOCH_ROUNDS: u8 = 1;
    const DEFAULT_GLOBAL_ROUNDS: u8 = 3;
    const GLOBAL_SCRAMBLE_LABEL: vector<u8> = b"GLOBAL_SCRAMBLE";

    const E_INVALID_RANGE: u64 = 1;
    const E_INVALID_EPOCH_BOUNDS: u64 = 2;
    const E_INPUT_OUT_OF_RANGE: u64 = 3;
    const E_RANGE_EXHAUSTED: u64 = 4;

    public struct State has key {
        id: UID,
        max_range: u64,
        min_epoch_size: u64,
        max_epoch_size: u64,
        epoch_size: u64,
        epoch_rounds: u8,
        global_rounds: u8,
        global_seed: vector<u8>,
        current_epoch_seed: vector<u8>,
        permutation_counter: u64,
    }

    public fun new(
        max_range: u64,
        min_epoch_size: u64,
        max_epoch_size: u64,
        epoch_rounds: u8,
        global_rounds: u8,
        chain_context: vector<u8>,
        deployment_height: u64,
        deployment_timestamp: u64,
        ctx: &mut TxContext,
    ): State {
        let final_max_range = default_u64(max_range, DEFAULT_MAX_RANGE);
        let final_min_epoch_size = default_u64(min_epoch_size, DEFAULT_MIN_EPOCH_SIZE);
        let final_max_epoch_size = default_u64(max_epoch_size, DEFAULT_MAX_EPOCH_SIZE);
        let final_epoch_rounds = default_u8(epoch_rounds, DEFAULT_EPOCH_ROUNDS);
        let final_global_rounds = default_u8(global_rounds, DEFAULT_GLOBAL_ROUNDS);

        assert!(final_max_range > 0, E_INVALID_RANGE);
        assert!(
            final_min_epoch_size > 0 && final_max_epoch_size >= final_min_epoch_size,
            E_INVALID_EPOCH_BOUNDS
        );

        let deployer = address_bytes(tx_context::sender(ctx));
        let contract_context = address_bytes(tx_context::sender(ctx));
        let epoch_size = derive_epoch_size(
            final_min_epoch_size,
            final_max_epoch_size,
            deployment_timestamp,
            &deployer,
            &chain_context,
        );
        let global_seed = derive_global_seed(&contract_context, deployment_height);

        State {
            id: object::new(ctx),
            max_range: final_max_range,
            min_epoch_size: final_min_epoch_size,
            max_epoch_size: final_max_epoch_size,
            epoch_size,
            epoch_rounds: final_epoch_rounds,
            global_rounds: final_global_rounds,
            global_seed,
            current_epoch_seed: zero_seed(),
            permutation_counter: 0,
        }
    }

    public fun next_value(
        state: &mut State,
        randomness_beacon: vector<u8>,
        caller: address,
        timestamp: u64,
    ): u64 {
        assert_not_exhausted(state.permutation_counter, state.max_range);
        let sequence_index = state.permutation_counter;

        if (sequence_index % state.epoch_size == 0) {
            state.current_epoch_seed = rotate_epoch_seed(
                &state.current_epoch_seed,
                &randomness_beacon,
                timestamp,
                caller,
            );
        };

        let value = compute_permutation(
            state.max_range,
            state.epoch_size,
            state.epoch_rounds,
            state.global_rounds,
            sequence_index,
            &state.current_epoch_seed,
            &state.global_seed,
        );

        state.permutation_counter = sequence_index + 1;
        value
    }

    public fun view_value(state: &State, sequence_index: u64): u64 {
        assert!(sequence_index < state.max_range, E_INPUT_OUT_OF_RANGE);
        let simulated_seed = simulate_epoch_seed(&state.current_epoch_seed);
        compute_permutation(
            state.max_range,
            state.epoch_size,
            state.epoch_rounds,
            state.global_rounds,
            sequence_index,
            &simulated_seed,
            &state.global_seed,
        )
    }

    public fun current_epoch_info(state: &State): (u64, vector<u8>, u64, u64) {
        (
            state.permutation_counter / state.epoch_size,
            copy_seed(&state.current_epoch_seed),
            state.permutation_counter % state.epoch_size,
            state.epoch_size,
        )
    }

    public fun destroy_zero(state: State) {
        let State {
            id,
            max_range: _,
            min_epoch_size: _,
            max_epoch_size: _,
            epoch_size: _,
            epoch_rounds: _,
            global_rounds: _,
            global_seed: _,
            current_epoch_seed: _,
            permutation_counter: _,
        } = state;
        object::delete(id);
    }

    fun compute_permutation(
        max_range: u64,
        epoch_size: u64,
        epoch_rounds: u8,
        global_rounds: u8,
        sequence_index: u64,
        epoch_seed: &vector<u8>,
        global_seed: &vector<u8>,
    ): u64 {
        let epoch_number = sequence_index / epoch_size;
        let first_index_of_epoch = epoch_number * epoch_size;
        let remaining_range = max_range - first_index_of_epoch;
        let actual_epoch_size = if (remaining_range < epoch_size) remaining_range else epoch_size;
        let relative_index = sequence_index % epoch_size;

        let epoch_permuted = feistel_permute(relative_index, epoch_seed, actual_epoch_size, epoch_rounds);
        let intermediate_value = first_index_of_epoch + epoch_permuted;
        let global_permuted = feistel_permute(intermediate_value, global_seed, max_range, global_rounds);

        global_permuted + 1
    }

    fun feistel_permute(input: u64, seed: &vector<u8>, range: u64, rounds: u8): u64 {
        if (range <= 1) {
            return 0
        };

        let (a, b) = find_grid(range);
        let round_limit = rounds as u64;
        let mut x = input;
        let mut result = 0;
        let mut resolved = false;

        while (!resolved) {
            let mut round = 0;
            while (round < round_limit) {
                let l = x / b;
                let r = x % b;
                let round_hash = round_hash_bytes(r, seed, round as u8);
                let l_new = r;
                let r_new = (l + hash_mod_u64(&round_hash, a)) % a;
                x = l_new * a + r_new;
                round = round + 1;
            };

            if (x < range) {
                result = x;
                resolved = true;
            };
        };

        result
    }

    fun find_grid(range: u64): (u64, u64) {
        if (range <= 1) {
            return (1, 1)
        };

        let a = integer_sqrt(range - 1) + 1;
        let b = (range + a - 1) / a;
        (a, b)
    }

    fun integer_sqrt(value: u64): u64 {
        if (value <= 1) {
            return value
        };

        let mut x0 = value;
        let mut x1 = (x0 + value / x0) / 2;
        while (x1 < x0) {
            x0 = x1;
            x1 = (x0 + value / x0) / 2;
        };

        x0
    }

    fun derive_epoch_size(
        min_epoch_size: u64,
        max_epoch_size: u64,
        timestamp: u64,
        deployer: &vector<u8>,
        chain_context: &vector<u8>,
    ): u64 {
        let spread = max_epoch_size - min_epoch_size + 1;
        let payload = concat3(&u64_bytes(timestamp), deployer, chain_context);
        let random = hash::sha3_256(payload);
        min_epoch_size + hash_mod_u64(&random, spread)
    }

    fun derive_global_seed(contract_context: &vector<u8>, height: u64): vector<u8> {
        let label = GLOBAL_SCRAMBLE_LABEL;
        let payload = concat3(contract_context, &u64_bytes(height), &label);
        hash::sha3_256(payload)
    }

    fun rotate_epoch_seed(
        current_epoch_seed: &vector<u8>,
        randomness_beacon: &vector<u8>,
        timestamp: u64,
        caller: address,
    ): vector<u8> {
        let payload = concat4(
            randomness_beacon,
            &u64_bytes(timestamp),
            &address_bytes(caller),
            current_epoch_seed,
        );
        let next_seed = hash::sha3_256(payload);
        if (is_zero_seed(&next_seed)) {
            seed_from_u8(1)
        } else {
            next_seed
        }
    }

    fun round_hash_bytes(r: u64, seed: &vector<u8>, round: u8): vector<u8> {
        let payload = concat3(&u64_bytes(r), seed, &vector[round]);
        hash::sha3_256(payload)
    }

    fun hash_mod_u64(bytes: &vector<u8>, modulo: u64): u64 {
        if (modulo == 0) {
            return 0
        };

        let mut i = 0;
        let mut acc = 0;
        let len = vector::length(bytes);
        while (i < len) {
            let byte = *vector::borrow(bytes, i) as u64;
            acc = ((acc * 256) + byte) % modulo;
            i = i + 1;
        };

        acc
    }

    fun address_bytes(addr: address): vector<u8> {
        bcs::to_bytes(&addr)
    }

    fun u64_bytes(value: u64): vector<u8> {
        bcs::to_bytes(&value)
    }

    fun concat3(a: &vector<u8>, b: &vector<u8>, c: &vector<u8>): vector<u8> {
        let mut out = copy_seed(a);
        vector::append(&mut out, copy_seed(b));
        vector::append(&mut out, copy_seed(c));
        out
    }

    fun concat4(a: &vector<u8>, b: &vector<u8>, c: &vector<u8>, d: &vector<u8>): vector<u8> {
        let mut out = copy_seed(a);
        vector::append(&mut out, copy_seed(b));
        vector::append(&mut out, copy_seed(c));
        vector::append(&mut out, copy_seed(d));
        out
    }

    fun zero_seed(): vector<u8> {
        let mut seed = vector::empty<u8>();
        let mut i = 0;
        while (i < 32u64) {
            vector::push_back(&mut seed, 0);
            i = i + 1;
        };
        seed
    }

    fun seed_from_u8(value: u8): vector<u8> {
        let mut seed = zero_seed();
        *vector::borrow_mut(&mut seed, 31) = value;
        seed
    }

    fun is_zero_seed(seed: &vector<u8>): bool {
        let mut i = 0;
        let len = vector::length(seed);
        while (i < len) {
            if (*vector::borrow(seed, i) != 0) {
                return false
            };
            i = i + 1;
        };
        true
    }

    fun copy_seed(seed: &vector<u8>): vector<u8> {
        let mut out = vector::empty<u8>();
        let mut i = 0;
        let len = vector::length(seed);
        while (i < len) {
            vector::push_back(&mut out, *vector::borrow(seed, i));
            i = i + 1;
        };
        out
    }

    fun simulate_epoch_seed(current_epoch_seed: &vector<u8>): vector<u8> {
        copy_seed(current_epoch_seed)
    }

    fun default_u64(value: u64, fallback: u64): u64 {
        if (value == 0) fallback else value
    }

    fun default_u8(value: u8, fallback: u8): u8 {
        if (value == 0) fallback else value
    }

    fun assert_not_exhausted(permutation_counter: u64, max_range: u64) {
        assert!(permutation_counter < max_range, E_RANGE_EXHAUSTED);
    }

    #[test]
    fun view_prefix_is_unique() {
        let mut ctx = tx_context::dummy();
        let limit = 8u64;
        let state = new(
            64,
            17,
            29,
            1,
            3,
            b"sui-test-chain",
            42,
            1_700_000_000,
            &mut ctx,
        );

        let mut seen = vector::empty<u64>();
        let mut step = 0u64;
        while (step < limit) {
            let value = view_value(&state, step);
            assert!(value >= 1 && value <= 64, E_INPUT_OUT_OF_RANGE);
            assert!(!contains_u64(&seen, value), E_INPUT_OUT_OF_RANGE);
            vector::push_back(&mut seen, value);
            step = step + 1;
        };

        destroy_zero(state);
    }

    #[test]
    fun view_returns_in_range_value() {
        let mut ctx = tx_context::dummy();
        let state = new(
            64,
            17,
            29,
            1,
            3,
            b"sui-test-chain",
            42,
            1_700_000_000,
            &mut ctx,
        );

        let value = view_value(&state, 31);
        assert!(value >= 1 && value <= 64, E_INPUT_OUT_OF_RANGE);

        destroy_zero(state);
    }

    #[test]
    fun next_value_rotates_seed_and_advances_counter() {
        let mut ctx = tx_context::dummy();
        let owner = tx_context::sender(&ctx);
        let mut state = new(
            64,
            17,
            29,
            1,
            3,
            b"sui-test-chain",
            42,
            1_700_000_000,
            &mut ctx,
        );

        let value = next_value(
            &mut state,
            hash::sha3_256(u64_bytes(0)),
            owner,
            1_700_000_000,
        );

        assert!(value >= 1 && value <= 64, E_INPUT_OUT_OF_RANGE);
        assert!(state.permutation_counter == 1u64, E_INPUT_OUT_OF_RANGE);
        assert!(!is_zero_seed(&state.current_epoch_seed), E_INPUT_OUT_OF_RANGE);

        destroy_zero(state);
    }

    #[test]
    fun next_value_exhausts_small_range_without_duplicates() {
        let mut ctx = tx_context::dummy();
        let owner = tx_context::sender(&ctx);
        let mut state = new(
            8,
            8,
            8,
            1,
            3,
            b"sui-test-chain",
            42,
            1_700_000_000,
            &mut ctx,
        );

        let mut seen = vector::empty<u64>();
        let mut step = 0u64;
        while (step < 8u64) {
            let value = next_value(
                &mut state,
                hash::sha3_256(u64_bytes(step)),
                owner,
                1_700_000_000 + step,
            );
            assert!(value >= 1 && value <= 8, E_INPUT_OUT_OF_RANGE);
            assert!(!contains_u64(&seen, value), E_INPUT_OUT_OF_RANGE);
            vector::push_back(&mut seen, value);
            step = step + 1;
        };

        assert!(state.permutation_counter == 8u64, E_INPUT_OUT_OF_RANGE);
        destroy_zero(state);
    }

    #[test, expected_failure(abort_code = E_RANGE_EXHAUSTED)]
    fun exhaustion_guard_aborts_at_max_range() {
        assert_not_exhausted(8u64, 8u64);
    }

    #[test_only]
    fun contains_u64(values: &vector<u64>, needle: u64): bool {
        let mut i = 0u64;
        let len = vector::length(values);
        while (i < len) {
            if (*vector::borrow(values, i) == needle) {
                return true
            };
            i = i + 1;
        };
        false
    }
}
