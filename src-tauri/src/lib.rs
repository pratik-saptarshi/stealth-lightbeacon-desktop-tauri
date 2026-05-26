use std::{
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
    time::Duration,
};

use serde::{de::DeserializeOwned, Deserialize, Serialize};
use tauri::{path::BaseDirectory, AppHandle, Manager, State};

const BACKEND_CONFIG_FILE: &str = "backend-config.json";
const DEFAULT_LOCAL_BASE_URL: &str = "http://127.0.0.1:8000";
const DEFAULT_TIMEOUT_MS: u64 = 15_000;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
enum BackendMode {
    Local,
    Remote,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct BackendConfig {
    mode: BackendMode,
    base_url: String,
    timeout_ms: u64,
}

impl Default for BackendConfig {
    fn default() -> Self {
        Self {
            mode: BackendMode::Local,
            base_url: DEFAULT_LOCAL_BASE_URL.into(),
            timeout_ms: DEFAULT_TIMEOUT_MS,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct HealthResponse {
    status: String,
    service: String,
    api_version: String,
    app_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct ApiModeResponse {
    mode: String,
    base_url: String,
    transport: String,
    api_version: String,
    supports_remote: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct CapabilitiesResponse {
    api_mode: ApiModeResponse,
    evaluation_profiles: Vec<String>,
    output_formats: Vec<String>,
    supports_recon: bool,
    supports_artifacts: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct CreateEvaluationRequest {
    target: String,
    profile: String,
    output_formats: Vec<String>,
    max_depth: u8,
    max_urls: u16,
    fail_on_critical: bool,
    budget_gate: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct CreateEvaluationResponse {
    evaluation_id: String,
    status: String,
    accepted_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct EvaluationStatusResponse {
    evaluation_id: String,
    status: String,
    stage: Option<String>,
    progress_percent: Option<u8>,
    message: Option<String>,
    exit_state: Option<String>,
    terminal: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct ApiError {
    code: String,
    message: String,
    status: Option<u16>,
    details: Option<String>,
}

impl ApiError {
    fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            status: None,
            details: None,
        }
    }

    fn with_status(
        code: impl Into<String>,
        message: impl Into<String>,
        status: u16,
        details: Option<String>,
    ) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            status: Some(status),
            details,
        }
    }

    fn with_details(
        code: impl Into<String>,
        message: impl Into<String>,
        details: impl Into<String>,
    ) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            status: None,
            details: Some(details.into()),
        }
    }
}

struct AppState {
    backend_config: Mutex<BackendConfig>,
}

impl AppState {
    fn new(backend_config: BackendConfig) -> Self {
        Self {
            backend_config: Mutex::new(backend_config),
        }
    }
}

fn config_path(app: &AppHandle) -> Result<PathBuf, ApiError> {
    app.path()
        .resolve(BACKEND_CONFIG_FILE, BaseDirectory::AppConfig)
        .map_err(|err| {
            ApiError::with_details(
                "config_path_error",
                "Unable to resolve the backend config path.",
                err.to_string(),
            )
        })
}

fn load_backend_config_from(path: &Path) -> Result<BackendConfig, ApiError> {
    if !path.exists() {
        return Ok(BackendConfig::default());
    }

    let raw = fs::read_to_string(path).map_err(|err| {
        ApiError::with_details(
            "config_read_error",
            "Unable to read the backend config file.",
            err.to_string(),
        )
    })?;

    let config = serde_json::from_str::<BackendConfig>(&raw).map_err(|err| {
        ApiError::with_details(
            "config_parse_error",
            "Unable to parse the backend config file.",
            err.to_string(),
        )
    })?;

    validate_backend_config(&config)?;

    Ok(config)
}

fn save_backend_config_to(path: &Path, config: &BackendConfig) -> Result<(), ApiError> {
    validate_backend_config(config)?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| {
            ApiError::with_details(
                "config_write_error",
                "Unable to create the backend config directory.",
                err.to_string(),
            )
        })?;
    }

    let serialized = serde_json::to_string_pretty(config).map_err(|err| {
        ApiError::with_details(
            "config_serialize_error",
            "Unable to serialize the backend config.",
            err.to_string(),
        )
    })?;

    fs::write(path, serialized).map_err(|err| {
        ApiError::with_details(
            "config_write_error",
            "Unable to persist the backend config.",
            err.to_string(),
        )
    })
}

fn load_backend_config(app: &AppHandle) -> Result<BackendConfig, ApiError> {
    load_backend_config_from(&config_path(app)?)
}

fn save_backend_config(app: &AppHandle, config: &BackendConfig) -> Result<(), ApiError> {
    save_backend_config_to(&config_path(app)?, config)
}

fn validate_backend_config(config: &BackendConfig) -> Result<(), ApiError> {
    if config.timeout_ms < 1_000 || config.timeout_ms > 60_000 {
        return Err(ApiError::new(
            "invalid_config",
            "Timeout must be between 1000 and 60000 milliseconds.",
        ));
    }

    let trimmed = config.base_url.trim();
    if trimmed.is_empty() {
        return Err(ApiError::new(
            "invalid_config",
            "Backend base URL is required.",
        ));
    }

    let url = reqwest::Url::parse(trimmed).map_err(|err| {
        ApiError::with_details(
            "invalid_config",
            "Backend base URL must be a valid absolute URL.",
            err.to_string(),
        )
    })?;

    match url.scheme() {
        "http" | "https" => Ok(()),
        _ => Err(ApiError::new(
            "invalid_config",
            "Backend base URL must use http or https.",
        )),
    }
}

fn validate_evaluation_request(request: &CreateEvaluationRequest) -> Result<(), ApiError> {
    if request.target.trim().is_empty() {
        return Err(ApiError::new(
            "invalid_request",
            "Evaluation target is required.",
        ));
    }

    if request.profile.trim().is_empty() {
        return Err(ApiError::new(
            "invalid_request",
            "Evaluation profile is required.",
        ));
    }

    if request.output_formats.is_empty() {
        return Err(ApiError::new(
            "invalid_request",
            "At least one output format must be selected.",
        ));
    }

    if request.max_depth == 0 || request.max_depth > 8 {
        return Err(ApiError::new(
            "invalid_request",
            "Max depth must be between 1 and 8.",
        ));
    }

    if request.max_urls == 0 || request.max_urls > 5000 {
        return Err(ApiError::new(
            "invalid_request",
            "Max URLs must be between 1 and 5000.",
        ));
    }

    Ok(())
}

fn current_backend_config(state: &State<'_, AppState>) -> Result<BackendConfig, ApiError> {
    state
        .backend_config
        .lock()
        .map_err(|_| ApiError::new("state_error", "The backend config state is unavailable."))
        .map(|guard| guard.clone())
}

fn normalize_backend_config(mut config: BackendConfig) -> BackendConfig {
    config.base_url = config.base_url.trim().trim_end_matches('/').to_string();
    config
}

async fn send_json_request<B, T>(
    config: &BackendConfig,
    method: reqwest::Method,
    path: &str,
    body: Option<&B>,
) -> Result<T, ApiError>
where
    B: Serialize + ?Sized,
    T: DeserializeOwned,
{
    validate_backend_config(config)?;

    let endpoint = format!("{}{}", config.base_url.trim_end_matches('/'), path);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(config.timeout_ms))
        .build()
        .map_err(|err| {
            ApiError::with_details(
                "client_build_error",
                "Unable to initialize the backend HTTP client.",
                err.to_string(),
            )
        })?;

    let request = client.request(method, endpoint.clone());
    let request = if let Some(payload) = body {
        request.json(payload)
    } else {
        request
    };

    let response = request.send().await.map_err(|err| {
        if err.is_timeout() {
            ApiError::with_details(
                "timeout",
                "The backend request timed out.",
                endpoint.clone(),
            )
        } else {
            ApiError::with_details(
                "transport_error",
                "The backend request could not be completed.",
                err.to_string(),
            )
        }
    })?;

    let status = response.status();
    if !status.is_success() {
        let details = response.text().await.ok();
        return Err(ApiError::with_status(
            "backend_error",
            format!("Backend request failed with status {}.", status.as_u16()),
            status.as_u16(),
            details,
        ));
    }

    response.json::<T>().await.map_err(|err| {
        ApiError::with_details(
            "decode_error",
            "The backend response could not be decoded.",
            err.to_string(),
        )
    })
}

async fn api_health_check_impl(config: &BackendConfig) -> Result<HealthResponse, ApiError> {
    send_json_request::<(), HealthResponse>(config, reqwest::Method::GET, "/health", None).await
}

async fn get_capabilities_impl(config: &BackendConfig) -> Result<CapabilitiesResponse, ApiError> {
    send_json_request::<(), CapabilitiesResponse>(
        config,
        reqwest::Method::GET,
        "/capabilities",
        None,
    )
    .await
}

async fn create_evaluation_impl(
    config: &BackendConfig,
    request: &CreateEvaluationRequest,
) -> Result<CreateEvaluationResponse, ApiError> {
    validate_evaluation_request(request)?;
    send_json_request(
        config,
        reqwest::Method::POST,
        "/evaluations",
        Some(request),
    )
    .await
}

async fn get_evaluation_status_impl(
    config: &BackendConfig,
    evaluation_id: &str,
) -> Result<EvaluationStatusResponse, ApiError> {
    if evaluation_id.trim().is_empty() {
        return Err(ApiError::new(
            "invalid_request",
            "Evaluation id is required.",
        ));
    }

    send_json_request::<(), EvaluationStatusResponse>(
        config,
        reqwest::Method::GET,
        &format!("/evaluations/{evaluation_id}"),
        None,
    )
    .await
}

#[tauri::command]
fn get_backend_config(state: State<'_, AppState>) -> Result<BackendConfig, ApiError> {
    current_backend_config(&state)
}

#[tauri::command]
fn set_backend_config(
    app: AppHandle,
    state: State<'_, AppState>,
    config: BackendConfig,
) -> Result<BackendConfig, ApiError> {
    let config = normalize_backend_config(config);
    validate_backend_config(&config)?;
    save_backend_config(&app, &config)?;

    let mut guard = state
        .backend_config
        .lock()
        .map_err(|_| ApiError::new("state_error", "The backend config state is unavailable."))?;
    *guard = config.clone();

    Ok(config)
}

#[tauri::command]
async fn api_health_check(state: State<'_, AppState>) -> Result<HealthResponse, ApiError> {
    let config = current_backend_config(&state)?;
    api_health_check_impl(&config).await
}

#[tauri::command]
async fn get_capabilities(state: State<'_, AppState>) -> Result<CapabilitiesResponse, ApiError> {
    let config = current_backend_config(&state)?;
    get_capabilities_impl(&config).await
}

#[tauri::command]
async fn create_evaluation(
    state: State<'_, AppState>,
    request: CreateEvaluationRequest,
) -> Result<CreateEvaluationResponse, ApiError> {
    let config = current_backend_config(&state)?;
    create_evaluation_impl(&config, &request).await
}

#[tauri::command]
async fn get_evaluation_status(
    state: State<'_, AppState>,
    evaluation_id: String,
) -> Result<EvaluationStatusResponse, ApiError> {
    let config = current_backend_config(&state)?;
    get_evaluation_status_impl(&config, &evaluation_id).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let config = load_backend_config(app.handle()).unwrap_or_default();
            app.manage(AppState::new(config));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_backend_config,
            set_backend_config,
            api_health_check,
            get_capabilities,
            create_evaluation,
            get_evaluation_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        io::{Read, Write},
        net::TcpListener,
        sync::{Arc, Mutex as StdMutex},
        thread,
    };

    #[derive(Clone)]
    struct StubExchange {
        expected_prefix: &'static str,
        expected_body: Option<&'static str>,
        status_line: &'static str,
        response_body: &'static str,
    }

    fn temp_config_path(name: &str) -> PathBuf {
        let mut path = std::env::temp_dir();
        path.push(format!("slb-desktop-{name}-{}.json", std::process::id()));
        path
    }

    fn sample_config(base_url: String) -> BackendConfig {
        BackendConfig {
            mode: BackendMode::Remote,
            base_url,
            timeout_ms: 5_000,
        }
    }

    fn sample_request() -> CreateEvaluationRequest {
        CreateEvaluationRequest {
            target: "https://example.com".into(),
            profile: "baseline".into(),
            output_formats: vec!["json".into(), "markdown".into()],
            max_depth: 2,
            max_urls: 250,
            fail_on_critical: true,
            budget_gate: false,
        }
    }

    fn spawn_stub_server(exchanges: Vec<StubExchange>) -> (String, Arc<StdMutex<Vec<String>>>) {
        let listener = TcpListener::bind("127.0.0.1:0").expect("listener");
        let address = format!("http://{}", listener.local_addr().expect("addr"));
        let requests = Arc::new(StdMutex::new(Vec::new()));
        let recorded_requests = Arc::clone(&requests);

        thread::spawn(move || {
            for exchange in exchanges {
                let (mut stream, _) = listener.accept().expect("accept");
                let mut buffer = [0_u8; 8192];
                let read = stream.read(&mut buffer).expect("read");
                let request = String::from_utf8_lossy(&buffer[..read]).to_string();

                assert!(
                    request.starts_with(exchange.expected_prefix),
                    "request {request:?} did not start with {:?}",
                    exchange.expected_prefix
                );
                if let Some(body) = exchange.expected_body {
                    assert!(
                        request.contains(body),
                        "request {request:?} did not contain {body:?}"
                    );
                }

                recorded_requests.lock().expect("record").push(request);

                let body_bytes = exchange.response_body.as_bytes();
                let response = format!(
                    "HTTP/1.1 {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    exchange.status_line,
                    body_bytes.len(),
                    exchange.response_body
                );
                stream.write_all(response.as_bytes()).expect("write");
                stream.flush().expect("flush");
            }
        });

        (address, requests)
    }

    #[test]
    fn backend_config_round_trips_on_disk() {
        let path = temp_config_path("config-roundtrip");
        let config = sample_config("http://127.0.0.1:9100".into());

        save_backend_config_to(&path, &config).expect("save config");
        let loaded = load_backend_config_from(&path).expect("load config");

        assert_eq!(loaded, config);

        let _ = fs::remove_file(path);
    }

    #[test]
    fn backend_config_validation_rejects_invalid_urls() {
        let config = BackendConfig {
            mode: BackendMode::Remote,
            base_url: "ftp://example.com".into(),
            timeout_ms: DEFAULT_TIMEOUT_MS,
        };

        let error = validate_backend_config(&config).expect_err("invalid config");
        assert_eq!(error.code, "invalid_config");
    }

    #[test]
    fn evaluation_request_validation_rejects_empty_payloads() {
        let request = CreateEvaluationRequest {
            target: String::new(),
            profile: String::new(),
            output_formats: Vec::new(),
            max_depth: 0,
            max_urls: 0,
            fail_on_critical: false,
            budget_gate: false,
        };

        let error = validate_evaluation_request(&request).expect_err("invalid request");
        assert_eq!(error.code, "invalid_request");
    }

    #[tokio::test]
    async fn http_adapter_supports_create_and_poll_flow() {
        let (base_url, recorded_requests) = spawn_stub_server(vec![
            StubExchange {
                expected_prefix: "GET /health HTTP/1.1",
                expected_body: None,
                status_line: "200 OK",
                response_body: r#"{"status":"ok","service":"stealth-lightbeacon-api","apiVersion":"0.1.0","appVersion":"2026.05.26"}"#,
            },
            StubExchange {
                expected_prefix: "GET /capabilities HTTP/1.1",
                expected_body: None,
                status_line: "200 OK",
                response_body: r#"{"apiMode":{"mode":"local","baseUrl":"http://127.0.0.1:8000","transport":"http","apiVersion":"0.1.0","supportsRemote":true},"evaluationProfiles":["baseline","deep","export"],"outputFormats":["json","markdown","html"],"supportsRecon":false,"supportsArtifacts":true}"#,
            },
            StubExchange {
                expected_prefix: "POST /evaluations HTTP/1.1",
                expected_body: Some(r#""target":"https://example.com""#),
                status_line: "202 Accepted",
                response_body: r#"{"evaluationId":"eval-123","status":"accepted","acceptedAt":"2026-05-26T12:00:00Z"}"#,
            },
            StubExchange {
                expected_prefix: "GET /evaluations/eval-123 HTTP/1.1",
                expected_body: None,
                status_line: "200 OK",
                response_body: r#"{"evaluationId":"eval-123","status":"running","stage":"analysis","progressPercent":56,"message":"Crawler in progress.","exitState":null,"terminal":false}"#,
            },
            StubExchange {
                expected_prefix: "GET /evaluations/eval-123 HTTP/1.1",
                expected_body: None,
                status_line: "200 OK",
                response_body: r#"{"evaluationId":"eval-123","status":"success","stage":"completed","progressPercent":100,"message":"Evaluation complete.","exitState":"success","terminal":true}"#,
            },
        ]);

        let config = sample_config(base_url);

        let health = api_health_check_impl(&config).await.expect("health");
        assert_eq!(health.status, "ok");

        let capabilities = get_capabilities_impl(&config).await.expect("capabilities");
        assert!(capabilities.supports_artifacts);

        let accepted = create_evaluation_impl(&config, &sample_request())
            .await
            .expect("create evaluation");
        assert_eq!(accepted.evaluation_id, "eval-123");

        let running = get_evaluation_status_impl(&config, "eval-123")
            .await
            .expect("running status");
        assert!(!running.terminal);
        assert_eq!(running.progress_percent, Some(56));

        let complete = get_evaluation_status_impl(&config, "eval-123")
            .await
            .expect("complete status");
        assert!(complete.terminal);
        assert_eq!(complete.exit_state.as_deref(), Some("success"));

        assert_eq!(recorded_requests.lock().expect("recorded").len(), 5);
    }
}
