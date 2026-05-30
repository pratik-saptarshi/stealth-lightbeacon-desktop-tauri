use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    process::Child,
    time::Instant,
};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CompatibilityResponse {
    pub minimum_desktop_version: String,
    pub recommended_desktop_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BackendMode {
    Local,
    Standalone,
    Remote,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BackendConfig {
    pub mode: BackendMode,
    pub base_url: String,
    pub port: u16,
    pub timeout_ms: u64,
}

const DEFAULT_LOCAL_BASE_URL: &str = "http://127.0.0.1:8000";
const DEFAULT_LOCAL_PORT: u16 = 8000;
const DEFAULT_TIMEOUT_MS: u64 = 15_000;

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
pub struct HealthResponse {
    pub status: String,
    pub service: String,
    pub api_version: String,
    pub app_version: Option<String>,
    pub auth_required: bool,
    pub compatibility: CompatibilityResponse,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ApiModeResponse {
    pub mode: String,
    pub base_url: String,
    pub transport: String,
    pub api_version: String,
    pub supports_remote: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CapabilitiesResponse {
    pub api_mode: ApiModeResponse,
    pub evaluation_profiles: Vec<String>,
    pub output_formats: Vec<String>,
    pub supports_recon: bool,
    pub supports_artifacts: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CreateEvaluationRequest {
    pub target: String,
    pub profile: String,
    pub output_formats: Vec<String>,
    pub max_depth: u8,
    pub max_urls: u16,
    pub fail_on_critical: bool,
    pub budget_gate: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CreateEvaluationResponse {
    pub evaluation_id: String,
    pub status: String,
    pub accepted_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct EvaluationStatusResponse {
    pub evaluation_id: String,
    pub status: String,
    pub stage: Option<String>,
    pub progress_percent: Option<u8>,
    pub message: Option<String>,
    pub exit_state: Option<String>,
    pub terminal: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EvaluationResultResponse {
    pub evaluation_id: String,
    pub status: String,
    #[serde(deserialize_with = "deserialize_summary_object")]
    pub summary: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactDescriptor {
    pub name: String,
    pub kind: String,
    pub media_type: String,
    pub download_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ReconRequest {
    pub target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ReconResponse {
    pub target: String,
    pub recommendation: String,
    pub posture: String,
    pub confidence: f64,
    pub evidence: Vec<String>,
    pub evidence_summary: String,
    pub signals: Vec<String>,
    pub auto_select_allowed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LastOpenedSnapshot {
    pub evaluation: CreateEvaluationResponse,
    pub evaluation_status: EvaluationStatusResponse,
    pub evaluation_result: EvaluationResultResponse,
    pub artifacts: Vec<ArtifactDescriptor>,
}

pub fn deserialize_summary_object<'de, D>(deserializer: D) -> Result<serde_json::Value, D::Error>
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

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ApiError {
    pub code: String,
    pub message: String,
    pub status: Option<u16>,
    pub details: Option<String>,
}

impl ApiError {
    pub fn new(code: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            status: None,
            details: None,
        }
    }

    pub fn with_status(
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

    pub fn with_details(
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

impl std::fmt::Display for ApiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[{}]: {}", self.code, self.message)
    }
}

impl std::error::Error for ApiError {}

impl serde::Serialize for ApiError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut state = serializer.serialize_struct("ApiError", 4)?;
        state.serialize_field("code", &self.code)?;
        state.serialize_field("message", &self.message)?;
        state.serialize_field("status", &self.status)?;
        state.serialize_field("details", &self.details)?;
        state.end()
    }
}

pub struct LocalBackendProcess {
    pub child: Child,
    pub base_url: String,
}

#[derive(Debug, Clone)]
pub struct StandaloneEvaluation {
    pub evaluation_id: String,
    pub request: CreateEvaluationRequest,
    pub accepted_at: String,
    pub created_at: Instant,
    pub findings: Vec<serde_json::Value>,
}
