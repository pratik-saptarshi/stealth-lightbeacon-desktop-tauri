use tauri::{AppHandle, State};

use crate::domain::{
    ArtifactDescriptor, BackendConfig, CapabilitiesResponse, CreateEvaluationRequest,
    CreateEvaluationResponse, EvaluationResultResponse, EvaluationStatusResponse, HealthResponse,
    LastOpenedSnapshot, ReconRequest, ReconResponse, ApiError, BackendMode,
};
use crate::{
    AppState, current_backend_config, normalize_backend_config, validate_backend_config,
    stop_local_backend_in_app_state, save_backend_config, replace_backend_config_in_app_state,
    effective_backend_config_from_app_state, api_health_check_impl, get_capabilities_impl,
    create_evaluation_impl, create_standalone_evaluation, validate_evaluation_id,
    standalone_lookup, standalone_evaluation_status, standalone_result_response,
    get_evaluation_status_impl, get_evaluation_result_impl, standalone_artifacts_response,
    get_evaluation_artifacts_impl, validate_recon_request, standalone_recon_response,
    run_recon_impl, load_last_opened_snapshot, save_last_opened_snapshot,
};

#[tauri::command]
pub fn get_backend_config(state: State<'_, AppState>) -> Result<BackendConfig, ApiError> {
    current_backend_config(&state)
}

#[tauri::command]
pub fn set_backend_config(
    app: AppHandle,
    state: State<'_, AppState>,
    config: BackendConfig,
) -> Result<BackendConfig, ApiError> {
    let config = normalize_backend_config(config);
    validate_backend_config(&config)?;
    stop_local_backend_in_app_state(state.inner())?;
    save_backend_config(&app, &config)?;
    replace_backend_config_in_app_state(state.inner(), config)
}

#[tauri::command]
pub async fn api_health_check(state: State<'_, AppState>) -> Result<HealthResponse, ApiError> {
    let config = current_backend_config(&state)?;
    if config.mode == BackendMode::Standalone {
        return Ok(crate::standalone_health_response());
    }
    let config = effective_backend_config_from_app_state(state.inner()).await?;
    api_health_check_impl(&config).await
}

#[tauri::command]
pub async fn get_capabilities(state: State<'_, AppState>) -> Result<CapabilitiesResponse, ApiError> {
    let config = current_backend_config(&state)?;
    if config.mode == BackendMode::Standalone {
        return Ok(crate::standalone_capabilities_response(&config));
    }
    let config = effective_backend_config_from_app_state(state.inner()).await?;
    get_capabilities_impl(&config).await
}

#[tauri::command]
pub async fn create_evaluation(
    state: State<'_, AppState>,
    request: CreateEvaluationRequest,
) -> Result<CreateEvaluationResponse, ApiError> {
    let config = current_backend_config(&state)?;
    if config.mode == BackendMode::Standalone {
        return create_standalone_evaluation(state.inner(), &request);
    }
    let config = effective_backend_config_from_app_state(state.inner()).await?;
    create_evaluation_impl(&config, &request).await
}

#[tauri::command]
pub async fn get_evaluation_status(
    state: State<'_, AppState>,
    evaluation_id: String,
) -> Result<EvaluationStatusResponse, ApiError> {
    let config = current_backend_config(&state)?;
    if config.mode == BackendMode::Standalone {
        validate_evaluation_id(&evaluation_id)?;
        return Ok(standalone_evaluation_status(&standalone_lookup(
            state.inner(),
            &evaluation_id,
        )?));
    }
    let config = effective_backend_config_from_app_state(state.inner()).await?;
    get_evaluation_status_impl(&config, &evaluation_id).await
}

#[tauri::command]
pub async fn get_evaluation_result(
    state: State<'_, AppState>,
    evaluation_id: String,
) -> Result<EvaluationResultResponse, ApiError> {
    let config = current_backend_config(&state)?;
    if config.mode == BackendMode::Standalone {
        validate_evaluation_id(&evaluation_id)?;
        let evaluation = standalone_lookup(state.inner(), &evaluation_id)?;
        let status = standalone_evaluation_status(&evaluation);
        if !status.terminal {
            return Err(ApiError::with_status(
                "not_ready",
                "Standalone evaluation result is not ready yet.",
                409,
                Some(evaluation_id),
            ));
        }
        return Ok(standalone_result_response(&evaluation));
    }
    let config = effective_backend_config_from_app_state(state.inner()).await?;
    get_evaluation_result_impl(&config, &evaluation_id).await
}

#[tauri::command]
pub async fn get_evaluation_artifacts(
    state: State<'_, AppState>,
    evaluation_id: String,
) -> Result<Vec<ArtifactDescriptor>, ApiError> {
    let config = current_backend_config(&state)?;
    if config.mode == BackendMode::Standalone {
        validate_evaluation_id(&evaluation_id)?;
        let evaluation = standalone_lookup(state.inner(), &evaluation_id)?;
        let status = standalone_evaluation_status(&evaluation);
        if !status.terminal {
            return Err(ApiError::with_status(
                "not_ready",
                "Standalone evaluation artifacts are not ready yet.",
                409,
                Some(evaluation_id),
            ));
        }
        return Ok(standalone_artifacts_response(&evaluation));
    }
    let config = effective_backend_config_from_app_state(state.inner()).await?;
    get_evaluation_artifacts_impl(&config, &evaluation_id).await
}

#[tauri::command]
pub async fn run_recon(
    state: State<'_, AppState>,
    request: ReconRequest,
) -> Result<ReconResponse, ApiError> {
    let config = current_backend_config(&state)?;
    if config.mode == BackendMode::Standalone {
        validate_recon_request(&request)?;
        return Ok(standalone_recon_response(&request));
    }
    let config = effective_backend_config_from_app_state(state.inner()).await?;
    run_recon_impl(&config, &request).await
}

#[tauri::command]
pub fn get_last_opened_snapshot(app: AppHandle) -> Result<Option<LastOpenedSnapshot>, ApiError> {
    load_last_opened_snapshot(&app)
}

#[tauri::command]
pub fn set_last_opened_snapshot(
    app: AppHandle,
    snapshot: LastOpenedSnapshot,
) -> Result<LastOpenedSnapshot, ApiError> {
    save_last_opened_snapshot(&app, &snapshot)?;
    Ok(snapshot)
}
