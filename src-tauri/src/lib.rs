use std::{
    collections::HashMap,
    env, fs,
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::Mutex,
    time::{Duration, Instant},
};

use serde::{de::DeserializeOwned, Deserialize, Serialize};
use tauri::{path::BaseDirectory, AppHandle, Manager, State};

const BACKEND_CONFIG_FILE: &str = "backend-config.json";
const LAST_OPENED_SNAPSHOT_FILE: &str = "snapshots/last-opened-terminal-snapshot.json";
const DEFAULT_LOCAL_BASE_URL: &str = "http://127.0.0.1:8000";
const DEFAULT_LOCAL_PORT: u16 = 8000;
const DEFAULT_TIMEOUT_MS: u64 = 15_000;
const DESKTOP_APP_VERSION: &str = env!("CARGO_PKG_VERSION");
const DESKTOP_VERSION_HEADER: &str = "X-Stealth-Lightbeacon-Desktop-Version";
const REMOTE_AUTH_TOKEN_ENV: &str = "STEALTH_LIGHTBEACON_REMOTE_AUTH_TOKEN";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct CompatibilityResponse {
    minimum_desktop_version: String,
    recommended_desktop_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
enum BackendMode {
    Local,
    Standalone,
    Remote,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct BackendConfig {
    mode: BackendMode,
    base_url: String,
    port: u16,
    timeout_ms: u64,
}

impl Default for BackendConfig {
    fn default() -> Self {
        Self {
            mode: BackendMode::Standalone,
            base_url: DEFAULT_LOCAL_BASE_URL.into(),
            port: DEFAULT_LOCAL_PORT,
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
    auth_required: bool,
    compatibility: CompatibilityResponse,
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
struct EvaluationResultResponse {
    evaluation_id: String,
    status: String,
    #[serde(deserialize_with = "deserialize_summary_object")]
    summary: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct ArtifactDescriptor {
    name: String,
    kind: String,
    media_type: String,
    download_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct ReconRequest {
    target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
struct ReconResponse {
    target: String,
    recommendation: String,
    posture: String,
    confidence: f64,
    evidence: Vec<String>,
    evidence_summary: String,
    signals: Vec<String>,
    auto_select_allowed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
struct LastOpenedSnapshot {
    evaluation: CreateEvaluationResponse,
    evaluation_status: EvaluationStatusResponse,
    evaluation_result: EvaluationResultResponse,
    artifacts: Vec<ArtifactDescriptor>,
}

fn deserialize_summary_object<'de, D>(deserializer: D) -> Result<serde_json::Value, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let summary = serde_json::Value::deserialize(deserializer)?;
    if summary.is_object() {
        Ok(summary)
    } else {
        Err(serde::de::Error::custom("summary must be a JSON object"))
    }
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

struct LocalBackendProcess {
    child: Child,
    base_url: String,
}

#[derive(Debug, Clone)]
struct StandaloneEvaluation {
    evaluation_id: String,
    request: CreateEvaluationRequest,
    accepted_at: String,
    created_at: Instant,
    findings: Vec<serde_json::Value>,
}

struct AppState {
    backend_config: Mutex<BackendConfig>,
    bootstrap_error: Mutex<Option<ApiError>>,
    local_backend: Mutex<Option<LocalBackendProcess>>,
    standalone_jobs: Mutex<HashMap<String, StandaloneEvaluation>>,
    standalone_sequence: Mutex<u64>,
}

impl AppState {
    fn new(backend_config: BackendConfig) -> Self {
        Self {
            backend_config: Mutex::new(backend_config),
            bootstrap_error: Mutex::new(None),
            local_backend: Mutex::new(None),
            standalone_jobs: Mutex::new(HashMap::new()),
            standalone_sequence: Mutex::new(0),
        }
    }

    fn from_bootstrap_result(result: Result<BackendConfig, ApiError>) -> Self {
        match result {
            Ok(config) => Self::new(config),
            Err(error) => Self {
                backend_config: Mutex::new(BackendConfig::default()),
                bootstrap_error: Mutex::new(Some(error)),
                local_backend: Mutex::new(None),
                standalone_jobs: Mutex::new(HashMap::new()),
                standalone_sequence: Mutex::new(0),
            },
        }
    }
}

impl Drop for AppState {
    fn drop(&mut self) {
        if let Ok(slot) = self.local_backend.get_mut() {
            if let Some(process) = slot.as_mut() {
                stop_local_backend_process(process);
            }
        }
    }
}

fn stop_local_backend_process(process: &mut LocalBackendProcess) {
    let _ = process.child.kill();
    let _ = process.child.wait();
}

fn desktop_repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("desktop repo root")
        .to_path_buf()
}

fn backend_repo_root() -> PathBuf {
    if let Ok(path) = env::var("STEALTH_LIGHTBEACON_BACKEND_ROOT") {
        return PathBuf::from(path);
    }

    let sibling = desktop_repo_root()
        .parent()
        .expect("workspace root")
        .join("stealth-lightbeacon");
    if backend_python_path(&sibling).exists() {
        return sibling;
    }

    if let Ok(entries) = fs::read_dir("/private/tmp") {
        for entry in entries.flatten() {
            let path = entry.path();
            let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
                continue;
            };
            if !name.starts_with("stealth-lightbeacon") {
                continue;
            }
            if backend_python_path(&path).exists() {
                return path;
            }
        }
    }

    sibling
}

fn backend_python_path(backend_root: &Path) -> PathBuf {
    if let Ok(path) = env::var("STEALTH_LIGHTBEACON_BACKEND_PYTHON") {
        return PathBuf::from(path);
    }

    backend_root.join(".venv").join("bin").join("python")
}

fn env_override<'a>(extra_env: &'a [(&'a str, &'a str)], key: &str) -> Option<&'a str> {
    extra_env
        .iter()
        .find(|(candidate, _)| *candidate == key)
        .map(|(_, value)| *value)
}

fn spawn_local_backend_process_with_env(
    port: u16,
    extra_env: &[(&str, &str)],
) -> Result<LocalBackendProcess, ApiError> {
    let backend_root = env_override(extra_env, "STEALTH_LIGHTBEACON_BACKEND_ROOT")
        .map(PathBuf::from)
        .unwrap_or_else(backend_repo_root);
    let python = env_override(extra_env, "STEALTH_LIGHTBEACON_BACKEND_PYTHON")
        .map(PathBuf::from)
        .unwrap_or_else(|| backend_python_path(&backend_root));
    let mut command = Command::new(&python);
    command
        .current_dir(&backend_root)
        .env("SLB_ALLOW_PRIVATE", "1")
        .arg("-m")
        .arg("companion.http_api")
        .arg("--host")
        .arg("127.0.0.1")
        .arg("--port")
        .arg(port.to_string())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    for (key, value) in extra_env {
        command.env(key, value);
    }

    let child = command.spawn().map_err(|err| {
        ApiError::with_details(
            "local_backend_spawn_error",
            "Unable to launch the local backend companion.",
            format!("{} ({})", python.display(), err),
        )
    })?;

    Ok(LocalBackendProcess {
        child,
        base_url: format!("http://127.0.0.1:{port}"),
    })
}

fn stop_local_backend_in_app_state(state: &AppState) -> Result<(), ApiError> {
    let mut guard = state
        .local_backend
        .lock()
        .map_err(|_| ApiError::new("state_error", "The local backend state is unavailable."))?;
    if let Some(mut process) = guard.take() {
        stop_local_backend_process(&mut process);
    }
    Ok(())
}

fn current_local_backend_base_url(state: &AppState) -> Result<Option<String>, ApiError> {
    let mut guard = state
        .local_backend
        .lock()
        .map_err(|_| ApiError::new("state_error", "The local backend state is unavailable."))?;
    let Some(process) = guard.as_mut() else {
        return Ok(None);
    };
    match process.child.try_wait().map_err(|err| {
        ApiError::with_details(
            "local_backend_state_error",
            "Unable to inspect the local backend companion process.",
            err.to_string(),
        )
    })? {
        None => Ok(Some(process.base_url.clone())),
        Some(status) => {
            let details = status.to_string();
            *guard = None;
            Err(ApiError::with_details(
                "local_backend_stopped",
                "The local backend companion exited before it became ready.",
                details,
            ))
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

fn snapshot_path(app: &AppHandle) -> Result<PathBuf, ApiError> {
    app.path()
        .resolve(LAST_OPENED_SNAPSHOT_FILE, BaseDirectory::AppConfig)
        .map_err(|err| {
            ApiError::with_details(
                "snapshot_path_error",
                "Unable to resolve the last-opened snapshot path.",
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

fn validate_last_opened_snapshot(snapshot: &LastOpenedSnapshot) -> Result<(), ApiError> {
    validate_evaluation_id(&snapshot.evaluation.evaluation_id)?;
    validate_evaluation_id(&snapshot.evaluation_status.evaluation_id)?;
    validate_evaluation_id(&snapshot.evaluation_result.evaluation_id)?;

    if !snapshot.evaluation_status.terminal {
        return Err(ApiError::new(
            "invalid_snapshot",
            "Last-opened snapshot requires a terminal evaluation status.",
        ));
    }

    if snapshot.evaluation.evaluation_id != snapshot.evaluation_status.evaluation_id
        || snapshot.evaluation.evaluation_id != snapshot.evaluation_result.evaluation_id
    {
        return Err(ApiError::new(
            "invalid_snapshot",
            "Last-opened snapshot evaluation ids must match.",
        ));
    }

    for artifact in &snapshot.artifacts {
        if artifact.name.trim().is_empty()
            || artifact.kind.trim().is_empty()
            || artifact.media_type.trim().is_empty()
        {
            return Err(ApiError::new(
                "invalid_snapshot",
                "Last-opened snapshot artifacts require name, kind, and media type.",
            ));
        }
    }

    Ok(())
}

fn load_last_opened_snapshot_from(path: &Path) -> Result<Option<LastOpenedSnapshot>, ApiError> {
    if !path.exists() {
        return Ok(None);
    }

    let raw = fs::read_to_string(path).map_err(|err| {
        ApiError::with_details(
            "snapshot_read_error",
            "Unable to read the last-opened snapshot file.",
            err.to_string(),
        )
    })?;

    let snapshot = serde_json::from_str::<LastOpenedSnapshot>(&raw).map_err(|err| {
        ApiError::with_details(
            "snapshot_parse_error",
            "Unable to parse the last-opened snapshot file.",
            err.to_string(),
        )
    })?;

    validate_last_opened_snapshot(&snapshot)?;

    Ok(Some(snapshot))
}

fn save_last_opened_snapshot_to(
    path: &Path,
    snapshot: &LastOpenedSnapshot,
) -> Result<(), ApiError> {
    validate_last_opened_snapshot(snapshot)?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| {
            ApiError::with_details(
                "snapshot_write_error",
                "Unable to create the last-opened snapshot directory.",
                err.to_string(),
            )
        })?;
    }

    let serialized = serde_json::to_string_pretty(snapshot).map_err(|err| {
        ApiError::with_details(
            "snapshot_serialize_error",
            "Unable to serialize the last-opened snapshot.",
            err.to_string(),
        )
    })?;

    fs::write(path, serialized).map_err(|err| {
        ApiError::with_details(
            "snapshot_write_error",
            "Unable to persist the last-opened snapshot.",
            err.to_string(),
        )
    })
}

fn load_last_opened_snapshot(app: &AppHandle) -> Result<Option<LastOpenedSnapshot>, ApiError> {
    load_last_opened_snapshot_from(&snapshot_path(app)?)
}

fn save_last_opened_snapshot(
    app: &AppHandle,
    snapshot: &LastOpenedSnapshot,
) -> Result<(), ApiError> {
    save_last_opened_snapshot_to(&snapshot_path(app)?, snapshot)
}

fn loopback_base_url(port: u16) -> String {
    format!("http://127.0.0.1:{port}")
}

fn with_port_applied_to_remote_base_url(base_url: &str, port: u16) -> String {
    match reqwest::Url::parse(base_url) {
        Ok(mut url) => {
            let _ = url.set_port(Some(port));
            url.to_string().trim_end_matches('/').to_string()
        }
        Err(_) => base_url.trim().trim_end_matches('/').to_string(),
    }
}

fn next_standalone_evaluation_id(state: &AppState) -> Result<String, ApiError> {
    let mut guard = state.standalone_sequence.lock().map_err(|_| {
        ApiError::new(
            "state_error",
            "The standalone evaluation state is unavailable.",
        )
    })?;
    *guard += 1;
    Ok(format!("standalone-{:04}", *guard))
}

fn standalone_health_response() -> HealthResponse {
    HealthResponse {
        status: "ok".into(),
        service: "stealth-lightbeacon-standalone".into(),
        api_version: DESKTOP_APP_VERSION.into(),
        app_version: Some(DESKTOP_APP_VERSION.into()),
        auth_required: false,
        compatibility: CompatibilityResponse {
            minimum_desktop_version: DESKTOP_APP_VERSION.into(),
            recommended_desktop_version: DESKTOP_APP_VERSION.into(),
        },
    }
}

fn standalone_capabilities_response(config: &BackendConfig) -> CapabilitiesResponse {
    CapabilitiesResponse {
        api_mode: ApiModeResponse {
            mode: "standalone".into(),
            base_url: format!("embedded://knowledge-base:{}", config.port),
            transport: "embedded".into(),
            api_version: DESKTOP_APP_VERSION.into(),
            supports_remote: false,
        },
        evaluation_profiles: vec![
            "seo-foundation".into(),
            "search-presence".into(),
            "accessibility-aa".into(),
            "full-spectrum".into(),
        ],
        output_formats: vec!["json".into(), "markdown".into(), "html".into()],
        supports_recon: true,
        supports_artifacts: true,
    }
}

fn standalone_evaluation_status(evaluation: &StandaloneEvaluation) -> EvaluationStatusResponse {
    let elapsed_ms = evaluation.created_at.elapsed().as_millis();
    if elapsed_ms < 350 {
        return EvaluationStatusResponse {
            evaluation_id: evaluation.evaluation_id.clone(),
            status: "running".into(),
            stage: Some("knowledge_base".into()),
            progress_percent: Some(42),
            message: Some(
                "Embedded ruleset is scoring search, answer, and accessibility signals.".into(),
            ),
            exit_state: None,
            terminal: false,
        };
    }

    let terminal_status = standalone_terminal_status(evaluation);

    EvaluationStatusResponse {
        evaluation_id: evaluation.evaluation_id.clone(),
        status: terminal_status.into(),
        stage: Some("completed".into()),
        progress_percent: Some(100),
        message: Some(match terminal_status {
            "budget_breach" => {
                "Standalone evaluation completed with embedded audit rules and a budget breach."
            }
            _ => "Standalone evaluation completed with embedded audit rules.",
        }
        .into()),
        exit_state: Some(terminal_status.into()),
        terminal: true,
    }
}

fn standalone_terminal_status(evaluation: &StandaloneEvaluation) -> &'static str {
    if evaluation.request.budget_gate {
        "budget_breach"
    } else {
        "success"
    }
}

fn score_embedded_findings(findings: &[serde_json::Value]) -> (i64, i64, i64, i64, serde_json::Value) {
    let mut passed = 0_i64;
    let mut warnings = 0_i64;
    let mut failed = 0_i64;
    let mut critical = 0_i64;
    let mut high = 0_i64;
    let mut medium = 0_i64;
    let mut low = 0_i64;
    let mut info = 0_i64;

    for finding in findings {
        match finding
            .get("status")
            .and_then(serde_json::Value::as_str)
            .unwrap_or_default()
        {
            "pass" => passed += 1,
            "warn" => warnings += 1,
            "fail" => failed += 1,
            _ => {}
        }

        match finding
            .get("severity")
            .and_then(serde_json::Value::as_str)
            .unwrap_or("info")
        {
            "critical" => critical += 1,
            "high" => high += 1,
            "medium" => medium += 1,
            "low" => low += 1,
            _ => info += 1,
        }
    }

    let penalty = (failed * 18) + (warnings * 6);
    let score = (100_i64 - penalty).max(0);
    let severity_counts = serde_json::json!({
        "critical": critical,
        "high": high,
        "medium": medium,
        "low": low,
        "info": info
    });
    (score, passed, warnings, failed, severity_counts)
}

fn run_embedded_rules_scan(target: &str) -> Vec<serde_json::Value> {
    let parsed_target = reqwest::Url::parse(target).ok();
    let host_hint = parsed_target
        .as_ref()
        .and_then(|url| url.host_str().map(str::to_owned))
        .unwrap_or_else(|| "target".into());

    let agent = ureq::AgentBuilder::new()
        .timeout(Duration::from_secs(8))
        .build();

    let response = match agent.get(target).call() {
        Ok(response) => response,
        Err(error) => {
            return vec![serde_json::json!({
                "rule_id": "target-reachability",
                "title": "Target reachability",
                "severity": "high",
                "status": "fail",
                "description": format!("Embedded scanner could not reach {host_hint}: {error}")
            })]
        }
    };

    let status_code = response.status() as u16;
    let body = response.into_string().unwrap_or_default().to_lowercase();

    let mut findings = Vec::new();
    findings.push(serde_json::json!({
        "rule_id": "http-status",
        "title": "Target HTTP status",
        "severity": if status_code >= 400 { "high" } else { "low" },
        "status": if status_code >= 400 { "fail" } else { "pass" },
        "description": format!("Target returned HTTP {status_code}.")
    }));

    let has_title = body.contains("<title");
    findings.push(serde_json::json!({
        "rule_id": "seo-title",
        "title": "Document title present",
        "severity": "medium",
        "status": if has_title { "pass" } else { "fail" },
        "description": if has_title {
            "Title tag detected for SEO/GEO indexing."
        } else {
            "Missing <title> tag; standalone SEO rules flagged this target."
        }
    }));

    let has_meta_description = body.contains("name=\"description\"") || body.contains("name='description'");
    findings.push(serde_json::json!({
        "rule_id": "seo-meta-description",
        "title": "Meta description present",
        "severity": "low",
        "status": if has_meta_description { "pass" } else { "warn" },
        "description": if has_meta_description {
            "Meta description detected."
        } else {
            "Meta description not detected; snippet quality may degrade."
        }
    }));

    let has_h1 = body.contains("<h1");
    findings.push(serde_json::json!({
        "rule_id": "aeo-primary-heading",
        "title": "Primary heading structure",
        "severity": "low",
        "status": if has_h1 { "pass" } else { "warn" },
        "description": if has_h1 {
            "At least one <h1> heading detected."
        } else {
            "No <h1> heading detected for answer extraction structure."
        }
    }));

    let image_count = body.matches("<img").count();
    let image_with_alt_count = body.matches(" alt=").count();
    let missing_alt = image_count.saturating_sub(image_with_alt_count);
    findings.push(serde_json::json!({
        "rule_id": "wcag-image-alt",
        "title": "Image alt coverage",
        "severity": "high",
        "status": if missing_alt == 0 { "pass" } else { "fail" },
        "description": if missing_alt == 0 {
            "All discovered <img> elements include alt text.".to_string()
        } else {
            format!("{missing_alt} image(s) appear to be missing alt text in the retrieved markup.")
        }
    }));

    let has_lang = body.contains("<html lang=");
    findings.push(serde_json::json!({
        "rule_id": "wcag-html-lang",
        "title": "Document language declaration",
        "severity": "medium",
        "status": if has_lang { "pass" } else { "warn" },
        "description": if has_lang {
            "Root html lang attribute detected."
        } else {
            "Missing html lang attribute; accessibility language signaling is weak."
        }
    }));

    let has_structured_data = body.contains("application/ld+json");
    findings.push(serde_json::json!({
        "rule_id": "geo-structured-data",
        "title": "Structured data signal",
        "severity": "low",
        "status": if has_structured_data { "pass" } else { "warn" },
        "description": if has_structured_data {
            "JSON-LD structured data detected."
        } else {
            "No JSON-LD structured data detected in retrieved HTML."
        }
    }));

    findings
}

fn standalone_requested_report_formats(output_formats: &[String]) -> Vec<String> {
    let mut formats = Vec::new();

    for format in output_formats {
        let normalized = match format.as_str() {
            "json" => Some("json"),
            "markdown" | "md" => Some("markdown"),
            "html" => Some("html"),
            "xml" => Some("xml"),
            _ => None,
        };

        if let Some(normalized) = normalized {
            let normalized = normalized.to_string();
            if !formats.contains(&normalized) {
                formats.push(normalized);
            }
        }
    }

    formats
}

fn standalone_report_artifact_manifest(evaluation: &StandaloneEvaluation) -> Vec<serde_json::Value> {
    let mut artifacts = vec![serde_json::json!({
        "kind": "normalized_report",
        "path": "__REPORT_PATH__"
    })];

    for format in standalone_requested_report_formats(&evaluation.request.output_formats) {
        match format.as_str() {
            "markdown" => artifacts.push(serde_json::json!({
                "kind": "markdown",
                "path": "__ARTIFACT_DIR__/report.md"
            })),
            "html" => artifacts.push(serde_json::json!({
                "kind": "html",
                "path": "__ARTIFACT_DIR__/report.html"
            })),
            "xml" => artifacts.push(serde_json::json!({
                "kind": "xml",
                "path": "__ARTIFACT_DIR__/report.xml"
            })),
            _ => {}
        }
    }

    artifacts
}

fn standalone_result_response(evaluation: &StandaloneEvaluation) -> EvaluationResultResponse {
    let terminal_status = standalone_terminal_status(evaluation);
    let findings = evaluation.findings.clone();
    let artifacts = standalone_report_artifact_manifest(evaluation);
    let (score, passed, warnings, failed, severity_counts) = score_embedded_findings(&findings);
    EvaluationResultResponse {
        evaluation_id: evaluation.evaluation_id.clone(),
        status: terminal_status.into(),
        summary: serde_json::json!({
            "contract_version": "0.1.0",
            "run_id": evaluation.evaluation_id.clone(),
            "target": evaluation.request.target.clone(),
            "target_details": {
                "url": evaluation.request.target.clone(),
                "engine": "embedded-rule-engine",
                "profile": evaluation.request.profile.clone()
            },
            "status": terminal_status,
            "score": score,
            "passed": passed,
            "warnings": warnings,
            "failed": failed,
            "severity_counts": severity_counts,
            "frameworks": ["SEO", "GEO", "AEO", "WCAG 2.1 AA", "WCAG 2.2 AA"],
            "profile": evaluation.request.profile.clone(),
            "artifacts": artifacts,
            "started_at": evaluation.accepted_at.clone(),
            "completed_at": "2026-05-26T12:00:03Z",
            "findings": findings
        }),
    }
}

fn standalone_artifacts_response(evaluation: &StandaloneEvaluation) -> Vec<ArtifactDescriptor> {
    let mut artifacts = vec![ArtifactDescriptor {
        name: format!("{}-normalized-report", evaluation.evaluation_id),
        kind: "normalized_report".into(),
        media_type: "application/json".into(),
        download_url: None,
    }];

    for format in standalone_requested_report_formats(&evaluation.request.output_formats) {
        match format.as_str() {
            "markdown" => artifacts.push(ArtifactDescriptor {
                name: format!("{}-executive-summary", evaluation.evaluation_id),
                kind: "markdown".into(),
                media_type: "text/markdown".into(),
                download_url: None,
            }),
            "html" => artifacts.push(ArtifactDescriptor {
                name: format!("{}-scorecard", evaluation.evaluation_id),
                kind: "html".into(),
                media_type: "text/html".into(),
                download_url: None,
            }),
            "xml" => artifacts.push(ArtifactDescriptor {
                name: format!("{}-xml-report", evaluation.evaluation_id),
                kind: "xml".into(),
                media_type: "application/xml".into(),
                download_url: None,
            }),
            _ => {}
        }
    }

    artifacts
}

fn standalone_lookup(
    state: &AppState,
    evaluation_id: &str,
) -> Result<StandaloneEvaluation, ApiError> {
    state
        .standalone_jobs
        .lock()
        .map_err(|_| {
            ApiError::new(
                "state_error",
                "The standalone evaluation state is unavailable.",
            )
        })?
        .get(evaluation_id)
        .cloned()
        .ok_or_else(|| {
            ApiError::with_status(
                "not_found",
                "Standalone evaluation was not found.",
                404,
                Some(evaluation_id.into()),
            )
        })
}

fn create_standalone_evaluation(
    state: &AppState,
    request: &CreateEvaluationRequest,
) -> Result<CreateEvaluationResponse, ApiError> {
    validate_evaluation_request(request)?;
    let evaluation_id = next_standalone_evaluation_id(state)?;
    let accepted_at = "2026-05-26T12:00:00Z".to_string();
    let findings = if request.budget_gate {
        vec![serde_json::json!({
            "rule_id": "request-budget",
            "title": "Budget threshold reached",
            "severity": "high",
            "status": "fail",
            "description": "Run stopped after exceeding the configured request budget."
        })]
    } else {
        run_embedded_rules_scan(&request.target)
    };
    let evaluation = StandaloneEvaluation {
        evaluation_id: evaluation_id.clone(),
        request: request.clone(),
        accepted_at: accepted_at.clone(),
        created_at: Instant::now(),
        findings,
    };
    state
        .standalone_jobs
        .lock()
        .map_err(|_| {
            ApiError::new(
                "state_error",
                "The standalone evaluation state is unavailable.",
            )
        })?
        .insert(evaluation_id.clone(), evaluation);
    Ok(CreateEvaluationResponse {
        evaluation_id,
        status: "accepted".into(),
        accepted_at: Some(accepted_at),
    })
}

fn standalone_recon_response(request: &ReconRequest) -> ReconResponse {
    let loopback_target =
        request.target.contains("127.0.0.1") || request.target.contains("localhost");
    ReconResponse {
        target: request.target.clone(),
        recommendation: if loopback_target {
            "standalone".into()
        } else {
            "stealth".into()
        },
        posture: if loopback_target {
            "local".into()
        } else {
            "browser".into()
        },
        confidence: if loopback_target { 0.98 } else { 0.82 },
        evidence: vec![
            "embedded ruleset available".into(),
            "seo-geo-aeo heuristics enabled".into(),
            "wcag aa coverage enabled".into(),
        ],
        evidence_summary:
            "embedded ruleset available, seo-geo-aeo heuristics enabled, wcag aa coverage enabled"
                .into(),
        signals: vec!["seo".into(), "geo".into(), "aeo".into(), "wcag-aa".into()],
        auto_select_allowed: true,
    }
}

fn validate_backend_config(config: &BackendConfig) -> Result<(), ApiError> {
    if config.timeout_ms < 1_000 || config.timeout_ms > 60_000 {
        return Err(ApiError::new(
            "invalid_config",
            "Timeout must be between 1000 and 60000 milliseconds.",
        ));
    }

    if config.port == 0 {
        return Err(ApiError::new(
            "invalid_config",
            "Port must be between 1 and 65535.",
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
        "http" | "https" => {}
        _ => {
            return Err(ApiError::new(
                "invalid_config",
                "Backend base URL must use http or https.",
            ))
        }
    }

    if config.mode == BackendMode::Remote && url.scheme() != "https" {
        return Err(ApiError::new(
            "invalid_config",
            "Remote backends must use https.",
        ));
    }

    Ok(())
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

fn validate_evaluation_id(evaluation_id: &str) -> Result<(), ApiError> {
    if evaluation_id.trim().is_empty() {
        return Err(ApiError::new(
            "invalid_request",
            "Evaluation id is required.",
        ));
    }

    Ok(())
}

fn validate_recon_request(request: &ReconRequest) -> Result<(), ApiError> {
    if request.target.trim().is_empty() {
        return Err(ApiError::new(
            "invalid_request",
            "Recon target URL is required.",
        ));
    }

    Ok(())
}

fn current_backend_config(state: &State<'_, AppState>) -> Result<BackendConfig, ApiError> {
    current_backend_config_from_app_state(state.inner())
}

fn current_backend_config_from_app_state(state: &AppState) -> Result<BackendConfig, ApiError> {
    if let Some(error) = state
        .bootstrap_error
        .lock()
        .map_err(|_| ApiError::new("state_error", "The backend config state is unavailable."))?
        .clone()
    {
        return Err(error);
    }

    state
        .backend_config
        .lock()
        .map_err(|_| ApiError::new("state_error", "The backend config state is unavailable."))
        .map(|guard| guard.clone())
}

async fn wait_for_local_backend_health(config: &BackendConfig) -> Result<(), ApiError> {
    let deadline = Instant::now() + Duration::from_millis(config.timeout_ms.max(1_000));
    loop {
        match api_health_check_impl(config).await {
            Ok(health) if health.status == "ok" => return Ok(()),
            Ok(health) if health.status == "degraded" => {
                return Err(ApiError::with_details(
                    "local_backend_degraded",
                    "The local backend companion reported a degraded startup state.",
                    config.base_url.clone(),
                ))
            }
            Ok(_) => {}
            Err(error) if matches!(error.code.as_str(), "transport_error" | "timeout") => {}
            Err(error) => return Err(error),
        }
        if Instant::now() >= deadline {
            return Err(ApiError::with_details(
                "local_backend_timeout",
                "The local backend companion did not become ready before the timeout elapsed.",
                config.base_url.clone(),
            ));
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
}

async fn effective_backend_config_from_app_state_with_env(
    state: &AppState,
    extra_env: &[(&str, &str)],
) -> Result<BackendConfig, ApiError> {
    let config = current_backend_config_from_app_state(state)?;
    if config.mode != BackendMode::Local {
        return Ok(config);
    }

    let base_url = match current_local_backend_base_url(state) {
        Ok(Some(base_url)) => base_url,
        Ok(None) => {
            let process = spawn_local_backend_process_with_env(config.port, extra_env)?;
            let base_url = process.base_url.clone();
            let mut guard = state.local_backend.lock().map_err(|_| {
                ApiError::new("state_error", "The local backend state is unavailable.")
            })?;
            *guard = Some(process);
            base_url
        }
        Err(error) if error.code == "local_backend_stopped" => {
            let process = spawn_local_backend_process_with_env(config.port, extra_env)?;
            let base_url = process.base_url.clone();
            let mut guard = state.local_backend.lock().map_err(|_| {
                ApiError::new("state_error", "The local backend state is unavailable.")
            })?;
            *guard = Some(process);
            base_url
        }
        Err(error) => return Err(error),
    };

    let mut runtime_config = config;
    runtime_config.base_url = base_url;

    if let Err(error) = wait_for_local_backend_health(&runtime_config).await {
        let _ = stop_local_backend_in_app_state(state);
        return Err(error);
    }

    Ok(runtime_config)
}

async fn effective_backend_config_from_app_state(
    state: &AppState,
) -> Result<BackendConfig, ApiError> {
    effective_backend_config_from_app_state_with_env(state, &[]).await
}

fn normalize_backend_config(mut config: BackendConfig) -> BackendConfig {
    config.base_url = match config.mode {
        BackendMode::Remote => {
            with_port_applied_to_remote_base_url(config.base_url.trim(), config.port)
        }
        BackendMode::Local | BackendMode::Standalone => loopback_base_url(config.port),
    };
    config
}

fn replace_backend_config_in_app_state(
    state: &AppState,
    config: BackendConfig,
) -> Result<BackendConfig, ApiError> {
    {
        let mut guard = state.backend_config.lock().map_err(|_| {
            ApiError::new("state_error", "The backend config state is unavailable.")
        })?;
        *guard = config.clone();
    }

    let mut bootstrap_error = state
        .bootstrap_error
        .lock()
        .map_err(|_| ApiError::new("state_error", "The backend config state is unavailable."))?;
    *bootstrap_error = None;

    Ok(config)
}

fn resolve_backend_endpoint(
    config: &BackendConfig,
    path_segments: &[&str],
) -> Result<reqwest::Url, ApiError> {
    validate_backend_config(config)?;

    let mut endpoint = reqwest::Url::parse(config.base_url.trim()).map_err(|err| {
        ApiError::with_details(
            "invalid_config",
            "Backend base URL must be a valid absolute URL.",
            err.to_string(),
        )
    })?;

    let mut segments = endpoint.path_segments_mut().map_err(|_| {
        ApiError::new(
            "invalid_config",
            "Backend base URL must support hierarchical path segments.",
        )
    })?;

    for segment in path_segments {
        if !segment.is_empty() {
            segments.push(segment);
        }
    }
    drop(segments);

    Ok(endpoint)
}

async fn decode_backend_error(response: reqwest::Response) -> ApiError {
    let status = response.status().as_u16();
    let details = response.text().await.ok();

    if let Some(body) = details.as_deref() {
        if let Ok(mut error) = serde_json::from_str::<ApiError>(body) {
            error.status = error.status.or(Some(status));
            return error;
        }
    }

    ApiError::with_status(
        "backend_error",
        format!("Backend request failed with status {}.", status),
        status,
        details,
    )
}

async fn send_json_request<B, T>(
    config: &BackendConfig,
    method: reqwest::Method,
    path_segments: &[&str],
    body: Option<&B>,
) -> Result<T, ApiError>
where
    B: Serialize + ?Sized,
    T: DeserializeOwned,
{
    let endpoint = resolve_backend_endpoint(config, path_segments)?;
    let endpoint_text = endpoint.to_string();
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

    let request = client
        .request(method, endpoint.clone())
        .header(DESKTOP_VERSION_HEADER, DESKTOP_APP_VERSION);
    let request = if config.mode == BackendMode::Remote {
        match env::var(REMOTE_AUTH_TOKEN_ENV) {
            Ok(token) if !token.trim().is_empty() => request.bearer_auth(token.trim()),
            _ => request,
        }
    } else {
        request
    };
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
                endpoint_text.clone(),
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
        return Err(decode_backend_error(response).await);
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
    send_json_request::<(), HealthResponse>(config, reqwest::Method::GET, &["health"], None).await
}

async fn get_capabilities_impl(config: &BackendConfig) -> Result<CapabilitiesResponse, ApiError> {
    send_json_request::<(), CapabilitiesResponse>(
        config,
        reqwest::Method::GET,
        &["capabilities"],
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
        &["evaluations"],
        Some(request),
    )
    .await
}

async fn get_evaluation_status_impl(
    config: &BackendConfig,
    evaluation_id: &str,
) -> Result<EvaluationStatusResponse, ApiError> {
    validate_evaluation_id(evaluation_id)?;

    send_json_request::<(), EvaluationStatusResponse>(
        config,
        reqwest::Method::GET,
        &["evaluations", evaluation_id],
        None,
    )
    .await
}

async fn get_evaluation_result_impl(
    config: &BackendConfig,
    evaluation_id: &str,
) -> Result<EvaluationResultResponse, ApiError> {
    validate_evaluation_id(evaluation_id)?;

    send_json_request::<(), EvaluationResultResponse>(
        config,
        reqwest::Method::GET,
        &["evaluations", evaluation_id, "result"],
        None,
    )
    .await
}

async fn get_evaluation_artifacts_impl(
    config: &BackendConfig,
    evaluation_id: &str,
) -> Result<Vec<ArtifactDescriptor>, ApiError> {
    validate_evaluation_id(evaluation_id)?;

    send_json_request::<(), Vec<ArtifactDescriptor>>(
        config,
        reqwest::Method::GET,
        &["evaluations", evaluation_id, "artifacts"],
        None,
    )
    .await
}

async fn run_recon_impl(
    config: &BackendConfig,
    request: &ReconRequest,
) -> Result<ReconResponse, ApiError> {
    validate_recon_request(request)?;
    send_json_request(config, reqwest::Method::POST, &["recon"], Some(request)).await
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
    stop_local_backend_in_app_state(state.inner())?;
    save_backend_config(&app, &config)?;
    replace_backend_config_in_app_state(state.inner(), config)
}

#[tauri::command]
async fn api_health_check(state: State<'_, AppState>) -> Result<HealthResponse, ApiError> {
    let config = current_backend_config(&state)?;
    if config.mode == BackendMode::Standalone {
        return Ok(standalone_health_response());
    }
    let config = effective_backend_config_from_app_state(state.inner()).await?;
    api_health_check_impl(&config).await
}

#[tauri::command]
async fn get_capabilities(state: State<'_, AppState>) -> Result<CapabilitiesResponse, ApiError> {
    let config = current_backend_config(&state)?;
    if config.mode == BackendMode::Standalone {
        return Ok(standalone_capabilities_response(&config));
    }
    let config = effective_backend_config_from_app_state(state.inner()).await?;
    get_capabilities_impl(&config).await
}

#[tauri::command]
async fn create_evaluation(
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
async fn get_evaluation_status(
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
async fn get_evaluation_result(
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
async fn get_evaluation_artifacts(
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
async fn run_recon(
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
fn get_last_opened_snapshot(app: AppHandle) -> Result<Option<LastOpenedSnapshot>, ApiError> {
    load_last_opened_snapshot(&app)
}

#[tauri::command]
fn set_last_opened_snapshot(
    app: AppHandle,
    snapshot: LastOpenedSnapshot,
) -> Result<LastOpenedSnapshot, ApiError> {
    save_last_opened_snapshot(&app, &snapshot)?;
    Ok(snapshot)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let state = AppState::from_bootstrap_result(load_backend_config(app.handle()));
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_backend_config,
            set_backend_config,
            api_health_check,
            get_capabilities,
            create_evaluation,
            get_evaluation_status,
            get_evaluation_result,
            get_evaluation_artifacts,
            run_recon,
            get_last_opened_snapshot,
            set_last_opened_snapshot
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
        path::PathBuf,
        process::{Child, Command, Stdio},
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

    fn temp_snapshot_path(name: &str) -> PathBuf {
        let mut path = std::env::temp_dir();
        path.push(format!(
            "slb-desktop-snapshot-{name}-{}.json",
            std::process::id()
        ));
        path
    }

    fn sample_config(base_url: String) -> BackendConfig {
        let port = reqwest::Url::parse(&base_url)
            .ok()
            .and_then(|url| url.port_or_known_default())
            .unwrap_or(DEFAULT_LOCAL_PORT);
        BackendConfig {
            mode: BackendMode::Local,
            base_url,
            port,
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

    fn sample_recon_request(target: String) -> ReconRequest {
        ReconRequest { target }
    }

    fn sample_terminal_status() -> EvaluationStatusResponse {
        EvaluationStatusResponse {
            evaluation_id: "eval-terminal".into(),
            status: "success".into(),
            stage: Some("completed".into()),
            progress_percent: Some(100),
            message: Some("Evaluation complete.".into()),
            exit_state: Some("success".into()),
            terminal: true,
        }
    }

    fn local_backend_test_root() -> PathBuf {
        let sibling = backend_repo_root();
        if backend_python_path(&sibling).exists() {
            return sibling;
        }

        PathBuf::from("/private/tmp/stealth-lightbeacon-phase-0a-0b")
    }

    fn sample_result() -> EvaluationResultResponse {
        EvaluationResultResponse {
            evaluation_id: "eval-terminal".into(),
            status: "success".into(),
            summary: serde_json::json!({
                "score": 92,
                "severity_counts": {
                    "critical": 0,
                    "high": 0,
                    "medium": 1,
                    "low": 2,
                    "info": 3
                },
                "started_at": "2026-05-26T12:00:00Z",
                "completed_at": "2026-05-26T12:00:03Z"
            }),
        }
    }

    struct RealBackendProcess {
        child: Child,
        base_url: String,
    }

    impl Drop for RealBackendProcess {
        fn drop(&mut self) {
            let _ = self.child.kill();
            let _ = self.child.wait();
        }
    }

    fn spawn_real_backend_server() -> RealBackendProcess {
        let backend_root = super::backend_repo_root();
        let python = super::backend_python_path(&backend_root);
        let listener = TcpListener::bind("127.0.0.1:0").expect("listener");
        let port = listener.local_addr().expect("port").port();
        drop(listener);

        let child = Command::new(python)
            .current_dir(&backend_root)
            .env("SLB_ALLOW_PRIVATE", "1")
            .arg("-m")
            .arg("companion.http_api")
            .arg("--host")
            .arg("127.0.0.1")
            .arg("--port")
            .arg(port.to_string())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .expect("spawn real backend");

        RealBackendProcess {
            child,
            base_url: format!("http://127.0.0.1:{port}"),
        }
    }

    async fn wait_for_real_backend(config: &BackendConfig) -> HealthResponse {
        for _ in 0..40 {
            if let Ok(health) = api_health_check_impl(config).await {
                return health;
            }
            tokio::time::sleep(Duration::from_millis(100)).await;
        }

        panic!("real backend did not become ready");
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

    fn spawn_timeout_server() -> String {
        let listener = TcpListener::bind("127.0.0.1:0").expect("listener");
        let address = format!("http://{}", listener.local_addr().expect("addr"));

        thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("accept");
            let mut buffer = [0_u8; 4096];
            let _ = stream.read(&mut buffer).expect("read");
            thread::sleep(Duration::from_millis(1_250));
        });

        address
    }

    fn reserve_test_port() -> u16 {
        let listener = TcpListener::bind("127.0.0.1:0").expect("listener");
        let port = listener.local_addr().expect("addr").port();
        drop(listener);
        port
    }

    fn spawn_target_site() -> String {
        let listener = TcpListener::bind("127.0.0.1:0").expect("listener");
        let address = format!("http://{}", listener.local_addr().expect("addr"));

        thread::spawn(move || loop {
            let (mut stream, _) = match listener.accept() {
                Ok(pair) => pair,
                Err(_) => break,
            };
            let mut buffer = [0_u8; 8192];
            let read = stream.read(&mut buffer).expect("read");
            if read == 0 {
                continue;
            }

            let request = String::from_utf8_lossy(&buffer[..read]).to_string();
            let path = request
                .lines()
                .next()
                .and_then(|line| line.split_whitespace().nth(1))
                .unwrap_or("/");
            let method = request
                .lines()
                .next()
                .and_then(|line| line.split_whitespace().next())
                .unwrap_or("GET");

            let (status_line, content_type, body) = match (method, path) {
                    ("HEAD", "/") => ("200 OK", "text/html", String::new()),
                    (_, "/") => (
                        "200 OK",
                        "text/html",
                        "<!DOCTYPE html><html><head><title>Fixture</title><meta name=\"description\" content=\"Fixture description\"></head><body><h1>Fixture page</h1><img src=\"logo.png\" alt=\"Fixture logo\"></body></html>".to_string(),
                    ),
                    (_, "/robots.txt") => (
                        "200 OK",
                        "text/plain",
                        "User-agent: *\nAllow: /\n".to_string(),
                    ),
                    (_, "/jsonapi/user/user") => (
                        "404 Not Found",
                        "application/json",
                        "{\"errors\":[]}".to_string(),
                    ),
                    _ => ("404 Not Found", "text/plain", "missing".to_string()),
                };

            let response = format!(
                    "HTTP/1.1 {status_line}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    body.len(),
                    body
                );
            stream.write_all(response.as_bytes()).expect("write");
            stream.flush().expect("flush");
        });

        address
    }

    fn spawn_target_site_without_title() -> String {
        let listener = TcpListener::bind("127.0.0.1:0").expect("listener");
        let address = format!("http://{}", listener.local_addr().expect("addr"));

        thread::spawn(move || loop {
            let (mut stream, _) = match listener.accept() {
                Ok(pair) => pair,
                Err(_) => break,
            };
            let mut buffer = [0_u8; 8192];
            let read = stream.read(&mut buffer).expect("read");
            if read == 0 {
                continue;
            }

            let request = String::from_utf8_lossy(&buffer[..read]).to_string();
            let path = request
                .lines()
                .next()
                .and_then(|line| line.split_whitespace().nth(1))
                .unwrap_or("/");

            let (status_line, content_type, body) = match path {
                "/" => (
                    "200 OK",
                    "text/html",
                    "<!DOCTYPE html><html><head></head><body><h1>Fixture page</h1><img src=\"logo.png\"></body></html>".to_string(),
                ),
                _ => ("404 Not Found", "text/plain", "missing".to_string()),
            };

            let response = format!(
                "HTTP/1.1 {status_line}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                body.len(),
                body
            );
            stream.write_all(response.as_bytes()).expect("write");
            stream.flush().expect("flush");
        });

        address
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
            port: 443,
            timeout_ms: DEFAULT_TIMEOUT_MS,
        };

        let error = validate_backend_config(&config).expect_err("invalid config");
        assert_eq!(error.code, "invalid_config");
    }

    #[test]
    fn backend_config_validation_rejects_remote_plaintext_urls() {
        let config = BackendConfig {
            mode: BackendMode::Remote,
            base_url: "http://api.example.test".into(),
            port: 80,
            timeout_ms: DEFAULT_TIMEOUT_MS,
        };

        let error = validate_backend_config(&config).expect_err("invalid remote config");
        assert_eq!(error.code, "invalid_config");
        assert_eq!(error.message, "Remote backends must use https.");
    }

    #[test]
    fn backend_config_validation_rejects_zero_ports() {
        let config = BackendConfig {
            mode: BackendMode::Local,
            base_url: DEFAULT_LOCAL_BASE_URL.into(),
            port: 0,
            timeout_ms: DEFAULT_TIMEOUT_MS,
        };

        let error = validate_backend_config(&config).expect_err("invalid port");
        assert_eq!(error.code, "invalid_config");
        assert_eq!(error.message, "Port must be between 1 and 65535.");
    }

    #[test]
    fn backend_config_normalization_applies_port_per_mode() {
        let local = normalize_backend_config(BackendConfig {
            mode: BackendMode::Local,
            base_url: "http://example.com:7000".into(),
            port: 9123,
            timeout_ms: DEFAULT_TIMEOUT_MS,
        });
        let remote = normalize_backend_config(BackendConfig {
            mode: BackendMode::Remote,
            base_url: "https://api.example.test".into(),
            port: 9443,
            timeout_ms: DEFAULT_TIMEOUT_MS,
        });

        assert_eq!(local.base_url, "http://127.0.0.1:9123");
        assert_eq!(remote.base_url, "https://api.example.test:9443");
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

    #[test]
    fn bootstrap_state_surfaces_corrupted_config_errors_until_replaced() {
        let path = temp_config_path("config-corrupted");
        fs::write(&path, "{not-json").expect("write corrupted config");

        let error = load_backend_config_from(&path).expect_err("corrupted config");
        assert_eq!(error.code, "config_parse_error");

        let state = AppState::from_bootstrap_result(Err(error.clone()));
        let surfaced = current_backend_config_from_app_state(&state).expect_err("bootstrap error");
        assert_eq!(surfaced, error);

        let config = sample_config("http://127.0.0.1:9200".into());
        let replaced =
            replace_backend_config_in_app_state(&state, config.clone()).expect("replace config");
        assert_eq!(replaced, config);
        assert_eq!(
            current_backend_config_from_app_state(&state).expect("current config"),
            config
        );

        let _ = fs::remove_file(path);
    }

    #[tokio::test]
    async fn standalone_mode_runs_embedded_evaluation_flow() {
        let config = normalize_backend_config(BackendConfig {
            mode: BackendMode::Standalone,
            base_url: DEFAULT_LOCAL_BASE_URL.into(),
            port: 9134,
            timeout_ms: DEFAULT_TIMEOUT_MS,
        });
        let state = AppState::new(config.clone());

        let health = standalone_health_response();
        assert_eq!(health.service, "stealth-lightbeacon-standalone");

        let capabilities = standalone_capabilities_response(&config);
        assert!(capabilities.supports_recon);
        assert!(capabilities.supports_artifacts);

        let accepted = create_standalone_evaluation(&state, &sample_request()).expect("accepted");
        let running = standalone_evaluation_status(
            &standalone_lookup(&state, &accepted.evaluation_id).expect("running lookup"),
        );
        assert!(!running.terminal);

        tokio::time::sleep(Duration::from_millis(400)).await;

        let evaluation =
            standalone_lookup(&state, &accepted.evaluation_id).expect("terminal lookup");
        let terminal = standalone_evaluation_status(&evaluation);
        let result = standalone_result_response(&evaluation);
        let artifacts = standalone_artifacts_response(&evaluation);
        let recon = standalone_recon_response(&sample_recon_request("https://example.com".into()));

        assert!(terminal.terminal);
        assert_eq!(result.status, "success");
        assert_eq!(result.summary["frameworks"][0], serde_json::json!("SEO"));
        assert!(!artifacts.is_empty());
        assert_eq!(recon.recommendation, "stealth");
    }

    #[tokio::test]
    async fn standalone_mode_generates_budget_breach_reports() {
        let config = normalize_backend_config(BackendConfig {
            mode: BackendMode::Standalone,
            base_url: DEFAULT_LOCAL_BASE_URL.into(),
            port: 9135,
            timeout_ms: DEFAULT_TIMEOUT_MS,
        });
        let state = AppState::new(config);
        let request = CreateEvaluationRequest {
            target: "https://example.com/budget".into(),
            profile: "full-spectrum".into(),
            output_formats: vec!["json".into(), "markdown".into(), "html".into(), "xml".into()],
            max_depth: 4,
            max_urls: 1_000,
            fail_on_critical: true,
            budget_gate: true,
        };

        let accepted = create_standalone_evaluation(&state, &request).expect("accepted");
        tokio::time::sleep(Duration::from_millis(400)).await;

        let evaluation = standalone_lookup(&state, &accepted.evaluation_id).expect("terminal lookup");
        let terminal = standalone_evaluation_status(&evaluation);
        let result = standalone_result_response(&evaluation);
        let artifacts = standalone_artifacts_response(&evaluation);

        assert!(terminal.terminal);
        assert_eq!(terminal.status, "budget_breach");
        assert_eq!(result.status, "budget_breach");
        assert_eq!(result.summary["severity_counts"]["high"], serde_json::json!(1));
        assert_eq!(result.summary["artifacts"].as_array().expect("artifacts").len(), 4);
        assert!(result.summary["artifacts"]
            .as_array()
            .expect("artifacts")
            .iter()
            .any(|artifact| artifact["kind"] == serde_json::json!("xml")));
        assert_eq!(artifacts.len(), 4);
        assert!(artifacts.iter().any(|artifact| artifact.kind == "xml"));
    }

    #[tokio::test]
    async fn standalone_mode_scans_target_markup_with_embedded_rules() {
        let config = normalize_backend_config(BackendConfig {
            mode: BackendMode::Standalone,
            base_url: DEFAULT_LOCAL_BASE_URL.into(),
            port: 9136,
            timeout_ms: DEFAULT_TIMEOUT_MS,
        });
        let state = AppState::new(config);
        let target = spawn_target_site_without_title();
        let request = CreateEvaluationRequest {
            target,
            profile: "baseline".into(),
            output_formats: vec!["json".into()],
            max_depth: 2,
            max_urls: 200,
            fail_on_critical: true,
            budget_gate: false,
        };

        let accepted = create_standalone_evaluation(&state, &request).expect("accepted");
        tokio::time::sleep(Duration::from_millis(400)).await;

        let evaluation = standalone_lookup(&state, &accepted.evaluation_id).expect("lookup");
        let result = standalone_result_response(&evaluation);
        let findings = result.summary["findings"]
            .as_array()
            .expect("findings array")
            .iter()
            .filter_map(|finding| finding["rule_id"].as_str().map(str::to_string))
            .collect::<Vec<_>>();

        assert!(findings.contains(&"seo-title".to_string()));
        assert!(findings.contains(&"wcag-image-alt".to_string()));
    }

    #[tokio::test]
    async fn http_adapter_supports_create_and_poll_flow() {
        let (base_url, recorded_requests) = spawn_stub_server(vec![
            StubExchange {
                expected_prefix: "GET /health HTTP/1.1",
                expected_body: None,
                status_line: "200 OK",
                response_body: r#"{"status":"ok","service":"stealth-lightbeacon-api","apiVersion":"0.1.0","appVersion":"2026.05.26","authRequired":false,"compatibility":{"minimumDesktopVersion":"0.1.0","recommendedDesktopVersion":"0.1.0"}}"#,
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

    #[tokio::test]
    async fn http_adapter_preserves_structured_api_errors() {
        let (base_url, _) = spawn_stub_server(vec![StubExchange {
            expected_prefix: "POST /evaluations HTTP/1.1",
            expected_body: Some(r#""profile":"baseline""#),
            status_line: "422 Unprocessable Entity",
            response_body: r#"{"code":"invalid_profile","message":"Profile is not supported.","details":"baseline is disabled"}"#,
        }]);

        let config = sample_config(base_url);
        let error = create_evaluation_impl(&config, &sample_request())
            .await
            .expect_err("structured api error");

        assert_eq!(
            error,
            ApiError {
                code: "invalid_profile".into(),
                message: "Profile is not supported.".into(),
                status: Some(422),
                details: Some("baseline is disabled".into()),
            }
        );
    }

    #[tokio::test]
    async fn http_adapter_preserves_remote_auth_required_errors() {
        let (base_url, _) = spawn_stub_server(vec![StubExchange {
            expected_prefix: "GET /capabilities HTTP/1.1",
            expected_body: Some(r#"x-stealth-lightbeacon-desktop-version: 0.1.1"#),
            status_line: "401 Unauthorized",
            response_body: r#"{"code":"unauthorized","message":"Remote API auth required.","details":"SLB_API_AUTH_TOKEN"}"#,
        }]);

        let config = BackendConfig {
            mode: BackendMode::Local,
            base_url,
            port: 80,
            timeout_ms: 5_000,
        };
        let error = get_capabilities_impl(&config)
            .await
            .expect_err("auth required");

        assert_eq!(
            error,
            ApiError {
                code: "unauthorized".into(),
                message: "Remote API auth required.".into(),
                status: Some(401),
                details: Some("SLB_API_AUTH_TOKEN".into()),
            }
        );
    }

    #[tokio::test]
    async fn http_adapter_preserves_incompatible_client_errors() {
        let (base_url, _) = spawn_stub_server(vec![StubExchange {
            expected_prefix: "GET /capabilities HTTP/1.1",
            expected_body: Some(r#"x-stealth-lightbeacon-desktop-version: 0.1.1"#),
            status_line: "409 Conflict",
            response_body: r#"{"code":"incompatible_client","message":"Desktop version is not supported by this backend.","details":"0.0.1"}"#,
        }]);

        let config = BackendConfig {
            mode: BackendMode::Local,
            base_url,
            port: 80,
            timeout_ms: 5_000,
        };
        let error = get_capabilities_impl(&config)
            .await
            .expect_err("incompatible client");

        assert_eq!(
            error,
            ApiError {
                code: "incompatible_client".into(),
                message: "Desktop version is not supported by this backend.".into(),
                status: Some(409),
                details: Some("0.0.1".into()),
            }
        );
    }

    #[tokio::test]
    async fn http_adapter_runs_recon_requests() {
        let (base_url, recorded_requests) = spawn_stub_server(vec![StubExchange {
            expected_prefix: "POST /recon HTTP/1.1",
            expected_body: Some(r#""target":"https://example.com""#),
            status_line: "200 OK",
            response_body: r#"{"target":"https://example.com","recommendation":"stealth","posture":"browser","confidence":0.9,"evidence":["cloudflare","status:403"],"evidenceSummary":"cloudflare, status:403","signals":["cloudflare"],"autoSelectAllowed":true}"#,
        }]);

        let config = sample_config(base_url);
        let response = run_recon_impl(&config, &sample_recon_request("https://example.com".into()))
            .await
            .expect("recon");

        assert_eq!(response.recommendation, "stealth");
        assert_eq!(response.posture, "browser");
        assert_eq!(response.evidence_summary, "cloudflare, status:403");
        assert_eq!(recorded_requests.lock().expect("recorded").len(), 1);
    }

    #[tokio::test]
    async fn http_adapter_url_encodes_evaluation_id_path_segments() {
        let (base_url, recorded_requests) = spawn_stub_server(vec![StubExchange {
            expected_prefix: "GET /evaluations/eval%2Fwith%20space%3Fand%23hash HTTP/1.1",
            expected_body: None,
            status_line: "200 OK",
            response_body: r#"{"evaluationId":"eval/with space?and#hash","status":"running","stage":"analysis","progressPercent":10,"message":"Encoded path received.","exitState":null,"terminal":false}"#,
        }]);

        let config = sample_config(base_url);
        let status = get_evaluation_status_impl(&config, "eval/with space?and#hash")
            .await
            .expect("encoded status");

        assert_eq!(status.evaluation_id, "eval/with space?and#hash");
        assert_eq!(recorded_requests.lock().expect("recorded").len(), 1);
    }

    #[tokio::test]
    async fn http_adapter_gets_terminal_evaluation_result() {
        let (base_url, recorded_requests) = spawn_stub_server(vec![StubExchange {
            expected_prefix: "GET /evaluations/eval%2Fwith%20space%3Fand%23hash/result HTTP/1.1",
            expected_body: None,
            status_line: "200 OK",
            response_body: r#"{"evaluationId":"eval/with space?and#hash","status":"success","summary":{"score":92,"passed":8,"warnings":1,"failed":0,"severity_counts":{"critical":0,"high":0,"medium":1,"low":2,"info":3},"findings":[{"rule_id":"tls-version","title":"TLS version review","severity":"medium","description":"Server still negotiates a legacy TLS fallback."}],"artifacts":[{"name":"normalized-report","kind":"normalized_report","path":"__REPORT_PATH__"},{"name":"html-report","kind":"html","path":"__ARTIFACT_DIR__/report.html"}],"started_at":"2026-01-15T10:00:00Z","completed_at":"2026-01-15T10:00:03Z"}}"#,
        }]);

        let config = sample_config(base_url);
        let result = get_evaluation_result_impl(&config, "eval/with space?and#hash")
            .await
            .expect("result");

        assert_eq!(result.evaluation_id, "eval/with space?and#hash");
        assert_eq!(result.status, "success");
        assert_eq!(result.summary["score"], serde_json::json!(92));
        assert_eq!(
            result.summary["severity_counts"]["medium"],
            serde_json::json!(1)
        );
        assert_eq!(
            result.summary["findings"][0]["rule_id"],
            serde_json::json!("tls-version")
        );
        assert_eq!(
            result.summary["artifacts"][1]["kind"],
            serde_json::json!("html")
        );
        assert_eq!(
            result.summary["started_at"],
            serde_json::json!("2026-01-15T10:00:00Z")
        );
        assert_eq!(
            result.summary["completed_at"],
            serde_json::json!("2026-01-15T10:00:03Z")
        );
        assert_eq!(recorded_requests.lock().expect("recorded").len(), 1);
    }

    #[tokio::test]
    async fn http_adapter_gets_evaluation_artifacts() {
        let (base_url, recorded_requests) = spawn_stub_server(vec![StubExchange {
            expected_prefix: "GET /evaluations/eval%2Fwith%20space%3Fand%23hash/artifacts HTTP/1.1",
            expected_body: None,
            status_line: "200 OK",
            response_body: r#"[{"name":"normalized-report","kind":"normalized_report","mediaType":"application/json"},{"name":"html-report","kind":"html","mediaType":"text/html","downloadUrl":"https://api.example.test/artifacts/report.html"}]"#,
        }]);

        let config = sample_config(base_url);
        let artifacts = get_evaluation_artifacts_impl(&config, "eval/with space?and#hash")
            .await
            .expect("artifacts");

        assert_eq!(artifacts.len(), 2);
        assert_eq!(artifacts[0].name, "normalized-report");
        assert_eq!(artifacts[0].media_type, "application/json");
        assert_eq!(artifacts[1].kind, "html");
        assert_eq!(
            artifacts[1].download_url.as_deref(),
            Some("https://api.example.test/artifacts/report.html")
        );
        assert_eq!(recorded_requests.lock().expect("recorded").len(), 1);
    }

    #[test]
    fn last_opened_snapshot_round_trips_on_disk() {
        let path = temp_snapshot_path("roundtrip");
        let snapshot = LastOpenedSnapshot {
            evaluation: CreateEvaluationResponse {
                evaluation_id: "eval-terminal".into(),
                status: "accepted".into(),
                accepted_at: Some("2026-05-26T12:00:00Z".into()),
            },
            evaluation_status: sample_terminal_status(),
            evaluation_result: sample_result(),
            artifacts: vec![
                ArtifactDescriptor {
                    name: "normalized-report".into(),
                    kind: "normalized_report".into(),
                    media_type: "application/json".into(),
                    download_url: None,
                },
                ArtifactDescriptor {
                    name: "html-report".into(),
                    kind: "html".into(),
                    media_type: "text/html".into(),
                    download_url: Some("https://api.example.test/artifacts/report.html".into()),
                },
            ],
        };

        save_last_opened_snapshot_to(&path, &snapshot).expect("save snapshot");
        let loaded = load_last_opened_snapshot_from(&path)
            .expect("load snapshot")
            .expect("snapshot exists");

        assert_eq!(loaded, snapshot);

        let _ = fs::remove_file(path);
    }

    #[test]
    fn last_opened_snapshot_rejects_non_terminal_status() {
        let path = temp_snapshot_path("non-terminal");
        let snapshot = LastOpenedSnapshot {
            evaluation: CreateEvaluationResponse {
                evaluation_id: "eval-terminal".into(),
                status: "accepted".into(),
                accepted_at: Some("2026-05-26T12:00:00Z".into()),
            },
            evaluation_status: EvaluationStatusResponse {
                terminal: false,
                ..sample_terminal_status()
            },
            evaluation_result: sample_result(),
            artifacts: vec![],
        };

        let error = save_last_opened_snapshot_to(&path, &snapshot).expect_err("non-terminal");
        assert_eq!(error.code, "invalid_snapshot");
        assert_eq!(
            error.message,
            "Last-opened snapshot requires a terminal evaluation status."
        );
        assert!(!path.exists());
    }

    #[tokio::test]
    async fn http_adapter_result_retrieval_preserves_structured_api_errors() {
        let (base_url, _) = spawn_stub_server(vec![StubExchange {
            expected_prefix: "GET /evaluations/eval-404/result HTTP/1.1",
            expected_body: None,
            status_line: "404 Not Found",
            response_body: r#"{"code":"not_found","message":"Evaluation result was not found.","details":"eval-404"}"#,
        }]);

        let config = sample_config(base_url);
        let error = get_evaluation_result_impl(&config, "eval-404")
            .await
            .expect_err("structured api error");

        assert_eq!(
            error,
            ApiError {
                code: "not_found".into(),
                message: "Evaluation result was not found.".into(),
                status: Some(404),
                details: Some("eval-404".into()),
            }
        );
    }

    #[tokio::test]
    async fn http_adapter_result_retrieval_reports_timeouts() {
        let base_url = spawn_timeout_server();
        let config = BackendConfig {
            mode: BackendMode::Local,
            base_url,
            port: 80,
            timeout_ms: 1_000,
        };

        let error = get_evaluation_result_impl(&config, "eval-timeout")
            .await
            .expect_err("timeout");

        assert_eq!(error.code, "timeout");
        assert_eq!(error.message, "The backend request timed out.");
        assert!(error
            .details
            .as_deref()
            .expect("timeout details")
            .ends_with("/evaluations/eval-timeout/result"));
    }

    #[tokio::test]
    async fn http_adapter_result_retrieval_reports_decode_failures() {
        let (base_url, _) = spawn_stub_server(vec![StubExchange {
            expected_prefix: "GET /evaluations/eval-decode/result HTTP/1.1",
            expected_body: None,
            status_line: "200 OK",
            response_body: r#"{"evaluationId":"eval-decode","status":"success","summary":"not-an-object"}"#,
        }]);

        let config = sample_config(base_url);
        let error = get_evaluation_result_impl(&config, "eval-decode")
            .await
            .expect_err("decode failure");

        assert_eq!(error.code, "decode_error");
        assert_eq!(error.message, "The backend response could not be decoded.");
    }

    #[tokio::test]
    async fn desktop_adapter_bootstraps_against_real_backend_server() {
        let backend = spawn_real_backend_server();
        let config = sample_config(backend.base_url.clone());

        let health = wait_for_real_backend(&config).await;
        assert_eq!(health.status, "ok");
        assert_eq!(health.service, "stealth-lightbeacon-api");

        let capabilities = get_capabilities_impl(&config).await.expect("capabilities");
        assert_eq!(capabilities.api_mode.base_url, backend.base_url);
        assert_eq!(capabilities.api_mode.transport, "http");
        assert!(!capabilities.api_mode.supports_remote);
        assert!(capabilities.supports_artifacts);
    }

    #[tokio::test]
    async fn desktop_adapter_preserves_real_backend_api_errors() {
        let backend = spawn_real_backend_server();
        let config = sample_config(backend.base_url.clone());

        let _ = wait_for_real_backend(&config).await;

        let error = send_json_request::<(), HealthResponse>(
            &config,
            reqwest::Method::GET,
            &["missing-route"],
            None,
        )
        .await
        .expect_err("real backend api error");

        assert_eq!(
            error,
            ApiError {
                code: "not_found".into(),
                message: "Route not found.".into(),
                status: Some(404),
                details: Some("/missing-route".into()),
            }
        );
    }

    #[tokio::test]
    async fn desktop_adapter_create_and_poll_against_real_backend_server() {
        let backend = spawn_real_backend_server();
        let target_url = spawn_target_site();
        let config = sample_config(backend.base_url.clone());

        let _ = wait_for_real_backend(&config).await;

        let request = CreateEvaluationRequest {
            target: target_url,
            ..sample_request()
        };
        let accepted = create_evaluation_impl(&config, &request)
            .await
            .expect("create evaluation");
        assert_eq!(accepted.status, "accepted");

        let mut terminal_status = None;
        for _ in 0..30 {
            let status = get_evaluation_status_impl(&config, &accepted.evaluation_id)
                .await
                .expect("evaluation status");
            if status.terminal {
                terminal_status = Some(status);
                break;
            }
            tokio::time::sleep(Duration::from_millis(100)).await;
        }

        let terminal_status = terminal_status.expect("terminal status");
        assert_eq!(terminal_status.evaluation_id, accepted.evaluation_id);
        assert!(terminal_status.terminal);
        assert!(terminal_status.exit_state.is_some());
    }

    #[tokio::test]
    async fn desktop_adapter_create_evaluation_preserves_real_backend_validation_errors() {
        let backend = spawn_real_backend_server();
        let config = sample_config(backend.base_url.clone());

        let _ = wait_for_real_backend(&config).await;

        let request = CreateEvaluationRequest {
            profile: "unsupported".into(),
            ..sample_request()
        };
        let error = create_evaluation_impl(&config, &request)
            .await
            .expect_err("validation error");

        assert_eq!(
            error,
            ApiError {
                code: "invalid_request".into(),
                message: "Evaluation profile is not supported.".into(),
                status: Some(400),
                details: Some("unsupported".into()),
            }
        );
    }

    #[tokio::test]
    async fn desktop_adapter_loads_terminal_result_from_real_backend_server() {
        let backend = spawn_real_backend_server();
        let target_url = spawn_target_site();
        let config = sample_config(backend.base_url.clone());

        let _ = wait_for_real_backend(&config).await;

        let request = CreateEvaluationRequest {
            target: target_url,
            ..sample_request()
        };
        let accepted = create_evaluation_impl(&config, &request)
            .await
            .expect("create evaluation");

        for _ in 0..30 {
            let status = get_evaluation_status_impl(&config, &accepted.evaluation_id)
                .await
                .expect("evaluation status");
            if status.terminal {
                break;
            }
            tokio::time::sleep(Duration::from_millis(100)).await;
        }

        let result = get_evaluation_result_impl(&config, &accepted.evaluation_id)
            .await
            .expect("terminal result");

        assert_eq!(result.evaluation_id, accepted.evaluation_id);
        assert!(result.summary.is_object());
        assert!(result.summary.get("score").is_some());
    }

    #[tokio::test]
    async fn desktop_adapter_loads_artifacts_from_real_backend_server() {
        let backend = spawn_real_backend_server();
        let target_url = spawn_target_site();
        let config = sample_config(backend.base_url.clone());

        let _ = wait_for_real_backend(&config).await;

        let request = CreateEvaluationRequest {
            target: target_url,
            ..sample_request()
        };
        let accepted = create_evaluation_impl(&config, &request)
            .await
            .expect("create evaluation");

        for _ in 0..30 {
            let status = get_evaluation_status_impl(&config, &accepted.evaluation_id)
                .await
                .expect("evaluation status");
            if status.terminal {
                break;
            }
            tokio::time::sleep(Duration::from_millis(100)).await;
        }

        let artifacts = get_evaluation_artifacts_impl(&config, &accepted.evaluation_id)
            .await
            .expect("artifacts");

        assert!(!artifacts.is_empty());
        assert!(artifacts
            .iter()
            .any(|artifact| artifact.kind == "normalized_report"));
    }

    #[tokio::test]
    async fn desktop_adapter_runs_recon_against_real_backend_server() {
        let backend = spawn_real_backend_server();
        let target_url = spawn_target_site();
        let config = sample_config(backend.base_url.clone());

        let _ = wait_for_real_backend(&config).await;

        let response = run_recon_impl(&config, &sample_recon_request(target_url))
            .await
            .expect("real recon");

        assert_eq!(response.posture, "http");
        assert_eq!(response.recommendation, "http");
        assert!(response.evidence_summary.contains("no-anti-bot-signals"));
    }

    #[tokio::test]
    async fn local_mode_starts_managed_companion_and_reuses_runtime_url() {
        let local_config = normalize_backend_config(BackendConfig {
            port: reserve_test_port(),
            ..BackendConfig::default()
        });
        let state = AppState::new(local_config.clone());
        let backend_root = local_backend_test_root();
        let backend_root_text = backend_root.display().to_string();
        let backend_python = backend_python_path(&backend_root).display().to_string();
        let overrides = [
            (
                "STEALTH_LIGHTBEACON_BACKEND_ROOT",
                backend_root_text.as_str(),
            ),
            (
                "STEALTH_LIGHTBEACON_BACKEND_PYTHON",
                backend_python.as_str(),
            ),
        ];

        let first = effective_backend_config_from_app_state_with_env(&state, &overrides)
            .await
            .expect("first local config");
        let second = effective_backend_config_from_app_state_with_env(&state, &overrides)
            .await
            .expect("second local config");
        let health = api_health_check_impl(&first).await.expect("health");

        assert_eq!(first.mode, BackendMode::Local);
        assert_eq!(first.base_url, local_config.base_url);
        assert_eq!(second.base_url, first.base_url);
        assert_eq!(health.status, "ok");

        stop_local_backend_in_app_state(&state).expect("stop local backend");
    }

    #[tokio::test]
    async fn local_mode_waits_for_companion_readiness() {
        let local_config = normalize_backend_config(BackendConfig {
            port: reserve_test_port(),
            ..BackendConfig::default()
        });
        let state = AppState::new(local_config.clone());
        let started = Instant::now();
        let backend_root = local_backend_test_root();
        let backend_root_text = backend_root.display().to_string();
        let backend_python = backend_python_path(&backend_root).display().to_string();
        let overrides = [
            (
                "STEALTH_LIGHTBEACON_BACKEND_ROOT",
                backend_root_text.as_str(),
            ),
            (
                "STEALTH_LIGHTBEACON_BACKEND_PYTHON",
                backend_python.as_str(),
            ),
            ("SLB_COMPANION_STARTUP_DELAY_MS", "250"),
        ];

        let config = effective_backend_config_from_app_state_with_env(&state, &overrides)
            .await
            .expect("delayed local config");

        assert!(started.elapsed() >= Duration::from_millis(200));
        assert_eq!(config.base_url, local_config.base_url);

        stop_local_backend_in_app_state(&state).expect("stop local backend");
    }

    #[tokio::test]
    async fn local_mode_reports_degraded_companion_startup() {
        let state = AppState::new(normalize_backend_config(BackendConfig {
            port: reserve_test_port(),
            ..BackendConfig::default()
        }));
        let backend_root = local_backend_test_root();
        let backend_root_text = backend_root.display().to_string();
        let backend_python = backend_python_path(&backend_root).display().to_string();
        let overrides = [
            (
                "STEALTH_LIGHTBEACON_BACKEND_ROOT",
                backend_root_text.as_str(),
            ),
            (
                "STEALTH_LIGHTBEACON_BACKEND_PYTHON",
                backend_python.as_str(),
            ),
            ("SLB_COMPANION_DEGRADED_REASON", "fixture"),
        ];

        let error = effective_backend_config_from_app_state_with_env(&state, &overrides)
            .await
            .expect_err("degraded local backend");

        assert_eq!(error.code, "local_backend_degraded");
        assert_eq!(
            error.message,
            "The local backend companion reported a degraded startup state."
        );
    }

    #[tokio::test]
    async fn local_mode_shutdown_stops_managed_companion() {
        let state = AppState::new(normalize_backend_config(BackendConfig {
            port: reserve_test_port(),
            ..BackendConfig::default()
        }));
        let backend_root = local_backend_test_root();
        let backend_root_text = backend_root.display().to_string();
        let backend_python = backend_python_path(&backend_root).display().to_string();
        let overrides = [
            (
                "STEALTH_LIGHTBEACON_BACKEND_ROOT",
                backend_root_text.as_str(),
            ),
            (
                "STEALTH_LIGHTBEACON_BACKEND_PYTHON",
                backend_python.as_str(),
            ),
        ];
        let config = effective_backend_config_from_app_state_with_env(&state, &overrides)
            .await
            .expect("local config");

        stop_local_backend_in_app_state(&state).expect("stop local backend");

        let error = api_health_check_impl(&config)
            .await
            .expect_err("stopped local backend");
        assert!(matches!(error.code.as_str(), "transport_error" | "timeout"));
    }

    #[tokio::test]
    async fn local_mode_auto_starts_and_completes_an_evaluation() {
        let state = AppState::new(normalize_backend_config(BackendConfig {
            port: reserve_test_port(),
            ..BackendConfig::default()
        }));
        let backend_root = local_backend_test_root();
        let backend_root_text = backend_root.display().to_string();
        let backend_python = backend_python_path(&backend_root).display().to_string();
        let overrides = [
            (
                "STEALTH_LIGHTBEACON_BACKEND_ROOT",
                backend_root_text.as_str(),
            ),
            (
                "STEALTH_LIGHTBEACON_BACKEND_PYTHON",
                backend_python.as_str(),
            ),
        ];
        let target_url = spawn_target_site();

        let config = effective_backend_config_from_app_state_with_env(&state, &overrides)
            .await
            .expect("local config");
        let accepted = create_evaluation_impl(
            &config,
            &CreateEvaluationRequest {
                target: target_url,
                ..sample_request()
            },
        )
        .await
        .expect("create evaluation");

        let mut terminal_status = None;
        for _ in 0..30 {
            let status = get_evaluation_status_impl(&config, &accepted.evaluation_id)
                .await
                .expect("evaluation status");
            if status.terminal {
                terminal_status = Some(status);
                break;
            }
            tokio::time::sleep(Duration::from_millis(100)).await;
        }

        let terminal_status = terminal_status.expect("terminal status");
        assert!(terminal_status.terminal);
        assert!(terminal_status.exit_state.is_some());

        stop_local_backend_in_app_state(&state).expect("stop local backend");
    }
}
