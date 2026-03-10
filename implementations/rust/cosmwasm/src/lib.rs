use cosmwasm_std::{
    entry_point, to_json_binary, Binary, Deps, DepsMut, Env, MessageInfo, Response, StdError,
    StdResult,
};
use cw_storage_plus::Item;
use epoch_permutation_core::{
    fingerprint32, keccak_bytes, DeploymentEntropy, EpochInfo, EpochPermutation,
    EpochPermutationConfig, EpochPermutationError, GenerationEntropy,
};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use thiserror::Error;

const ENGINE: Item<EpochPermutation> = Item::new("engine");

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
pub struct InstantiateMsg {
    pub max_range: Option<u64>,
    pub min_epoch_size: Option<u64>,
    pub max_epoch_size: Option<u64>,
    pub epoch_rounds: Option<u8>,
    pub global_rounds: Option<u8>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ExecuteMsg {
    NextValue {},
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryMsg {
    State {},
    View { sequence_index: u64 },
    EpochInfo {},
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
pub struct StateResponse {
    pub max_range: u64,
    pub epoch_size: u64,
    pub permutation_counter: u64,
    pub current_epoch: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
pub struct NextValueResponse {
    pub sequence_index: u64,
    pub value: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
pub struct ViewResponse {
    pub sequence_index: u64,
    pub value: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
pub struct EpochInfoResponse {
    pub epoch_number: u64,
    pub position_in_epoch: u64,
    pub epoch_size: u64,
    pub epoch_seed: Vec<u8>,
}

#[derive(Error, Debug)]
pub enum ContractError {
    #[error("{0}")]
    Std(#[from] StdError),

    #[error("{0}")]
    Engine(#[from] EngineContractError),
}

#[derive(Error, Debug)]
#[error("{message}")]
pub struct EngineContractError {
    message: String,
}

impl From<EpochPermutationError> for EngineContractError {
    fn from(value: EpochPermutationError) -> Self {
        Self {
            message: value.to_string(),
        }
    }
}

impl From<EpochPermutationError> for ContractError {
    fn from(value: EpochPermutationError) -> Self {
        Self::Engine(value.into())
    }
}

#[entry_point]
pub fn instantiate(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: InstantiateMsg,
) -> Result<Response, ContractError> {
    let config = EpochPermutationConfig {
        max_range: msg.max_range.unwrap_or_default(),
        min_epoch_size: msg.min_epoch_size.unwrap_or_default(),
        max_epoch_size: msg.max_epoch_size.unwrap_or_default(),
        epoch_rounds: msg.epoch_rounds.unwrap_or_default(),
        global_rounds: msg.global_rounds.unwrap_or_default(),
    };

    let deployment_entropy = DeploymentEntropy {
        timestamp: env.block.time.seconds(),
        deployer: fingerprint32(info.sender.as_bytes()),
        chain_context: fingerprint32(env.block.chain_id.as_bytes()),
        contract_context: fingerprint32(env.contract.address.as_bytes()),
        height: env.block.height,
    };

    let engine = EpochPermutation::new(config, &deployment_entropy)?;
    ENGINE.save(deps.storage, &engine)?;

    Ok(Response::new()
        .add_attribute("action", "instantiate")
        .add_attribute("epoch_size", engine.epoch_size.to_string())
        .add_attribute("max_range", engine.max_range.to_string()))
}

#[entry_point]
pub fn execute(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> Result<Response, ContractError> {
    match msg {
        ExecuteMsg::NextValue {} => execute_next_value(deps, env, info),
    }
}

fn execute_next_value(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
) -> Result<Response, ContractError> {
    let mut engine = ENGINE.load(deps.storage)?;
    let sequence_index = engine.permutation_counter;

    // Hash stable chain context into a 32-byte epoch entropy input for this execution.
    let randomness_beacon = keccak_bytes(&[
        env.block.chain_id.as_bytes(),
        &env.block.height.to_be_bytes(),
        &env.block.time.seconds().to_be_bytes(),
    ]);

    let entropy = GenerationEntropy {
        randomness_beacon,
        timestamp: env.block.time.seconds(),
        caller: fingerprint32(info.sender.as_bytes()),
    };

    let value = engine.next_value(&entropy)?;
    ENGINE.save(deps.storage, &engine)?;

    Ok(Response::new()
        .add_attribute("action", "next_value")
        .add_attribute("sequence_index", sequence_index.to_string())
        .add_attribute("value", value.to_string())
        .set_data(to_json_binary(&NextValueResponse {
            sequence_index,
            value,
        })?))
}

#[entry_point]
pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::State {} => to_json_binary(&query_state(deps)?),
        QueryMsg::View { sequence_index } => to_json_binary(&query_view(deps, sequence_index)?),
        QueryMsg::EpochInfo {} => to_json_binary(&query_epoch_info(deps)?),
    }
}

fn query_state(deps: Deps) -> StdResult<StateResponse> {
    let engine = ENGINE.load(deps.storage)?;
    let epoch_info: EpochInfo = engine.current_epoch_info();

    Ok(StateResponse {
        max_range: engine.max_range,
        epoch_size: engine.epoch_size,
        permutation_counter: engine.permutation_counter,
        current_epoch: epoch_info.epoch_number,
    })
}

fn query_view(deps: Deps, sequence_index: u64) -> Result<ViewResponse, ContractError> {
    let engine = ENGINE.load(deps.storage)?;
    let value = engine.view_value(sequence_index)?;

    Ok(ViewResponse {
        sequence_index,
        value,
    })
}

fn query_epoch_info(deps: Deps) -> StdResult<EpochInfoResponse> {
    let engine = ENGINE.load(deps.storage)?;
    let epoch_info: EpochInfo = engine.current_epoch_info();

    Ok(EpochInfoResponse {
        epoch_number: epoch_info.epoch_number,
        position_in_epoch: epoch_info.position_in_epoch,
        epoch_size: epoch_info.epoch_size,
        epoch_seed: epoch_info.epoch_seed.to_vec(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use cosmwasm_std::{
        from_json,
        testing::{message_info, mock_dependencies, mock_env},
        Addr, Timestamp,
    };
    use std::collections::HashSet;

    fn instantiate_with_range(max_range: u64) -> (cosmwasm_std::OwnedDeps<
        cosmwasm_std::testing::MockStorage,
        cosmwasm_std::testing::MockApi,
        cosmwasm_std::testing::MockQuerier,
    >, Env) {
        let mut deps = mock_dependencies();
        let mut env = mock_env();
        env.block.height = 17;
        env.block.time = Timestamp::from_seconds(1_700_000_000);
        let info = message_info(&Addr::unchecked("initializer"), &[]);

        instantiate(
            deps.as_mut(),
            env.clone(),
            info,
            InstantiateMsg {
                max_range: Some(max_range),
                min_epoch_size: Some(17),
                max_epoch_size: Some(17),
                epoch_rounds: Some(1),
                global_rounds: Some(3),
            },
        )
        .unwrap();

        (deps, env)
    }

    #[test]
    fn cosmwasm_contract_generates_unique_values_and_updates_state() {
        let max_range = 25_000u64;
        let (mut deps, mut env) = instantiate_with_range(max_range);
        let mut seen = HashSet::with_capacity(max_range as usize);

        for step in 0..max_range {
            env.block.height = 17 + step;
            env.block.time = Timestamp::from_seconds(1_700_000_000 + step);
            let response = execute(
                deps.as_mut(),
                env.clone(),
                message_info(&Addr::unchecked("runner"), &[]),
                ExecuteMsg::NextValue {},
            )
            .unwrap();
            let payload: NextValueResponse = from_json(response.data.unwrap()).unwrap();

            assert_eq!(payload.sequence_index, step);
            assert!(seen.insert(payload.value), "duplicate value generated: {}", payload.value);
        }

        assert_eq!(seen.len() as u64, max_range);

        let state: StateResponse = from_json(query(deps.as_ref(), env, QueryMsg::State {}).unwrap()).unwrap();
        assert_eq!(state.permutation_counter, max_range);
        assert_eq!(state.max_range, max_range);
    }

    #[test]
    fn cosmwasm_contract_reports_range_exhaustion_after_last_value() {
        let max_range = 16u64;
        let (mut deps, mut env) = instantiate_with_range(max_range);

        for step in 0..max_range {
            env.block.height = 17 + step;
            env.block.time = Timestamp::from_seconds(1_700_000_000 + step);
            execute(
                deps.as_mut(),
                env.clone(),
                message_info(&Addr::unchecked("runner"), &[]),
                ExecuteMsg::NextValue {},
            )
            .unwrap();
        }

        let error = execute(
            deps.as_mut(),
            env,
            message_info(&Addr::unchecked("runner"), &[]),
            ExecuteMsg::NextValue {},
        )
        .unwrap_err();

        assert_eq!(error.to_string(), "range exhausted (16/16)");
    }

    #[test]
    fn cosmwasm_contract_rotates_seed_and_advances_state_on_first_generation() {
        let (mut deps, env) = instantiate_with_range(64);

        execute(
            deps.as_mut(),
            env.clone(),
            message_info(&Addr::unchecked("runner"), &[]),
            ExecuteMsg::NextValue {},
        )
        .unwrap();

        let state: StateResponse = from_json(query(deps.as_ref(), env.clone(), QueryMsg::State {}).unwrap()).unwrap();
        let epoch_info: EpochInfoResponse =
            from_json(query(deps.as_ref(), env, QueryMsg::EpochInfo {}).unwrap()).unwrap();

        assert_eq!(state.permutation_counter, 1);
        assert_eq!(epoch_info.epoch_number, 0);
        assert_eq!(epoch_info.position_in_epoch, 1);
        assert_ne!(epoch_info.epoch_seed, vec![0u8; 32]);
    }

    #[test]
    fn cosmwasm_contract_view_prefix_is_unique_and_in_range() {
        let (deps, env) = instantiate_with_range(64);
        let mut seen = HashSet::new();

        for sequence_index in 0..8 {
            let response: ViewResponse = from_json(
                query(
                    deps.as_ref(),
                    env.clone(),
                    QueryMsg::View { sequence_index },
                )
                .unwrap(),
            )
            .unwrap();

            assert_eq!(response.sequence_index, sequence_index);
            assert!((1..=64).contains(&response.value));
            assert!(seen.insert(response.value), "duplicate view value generated: {}", response.value);
        }
    }

    #[test]
    fn cosmwasm_contract_rejects_out_of_range_view_requests() {
        let (deps, env) = instantiate_with_range(64);

        let error = query(
            deps.as_ref(),
            env,
            QueryMsg::View { sequence_index: 64 },
        )
        .unwrap_err();

        assert!(error.to_string().contains("input 64 out of range (max 63)"));
    }
}
