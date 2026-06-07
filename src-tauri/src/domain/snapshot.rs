use super::{ApiError, LastOpenedSnapshot};
use crate::validate_evaluation_id;
use serde_json;
use std::{
    fs,
    path::Path,
};

pub(crate) fn validate_last_opened_snapshot(snapshot: &LastOpenedSnapshot) -> Result<(), ApiError> {
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

pub(crate) fn load_last_opened_snapshot_from(
    path: &Path,
) -> Result<Option<LastOpenedSnapshot>, ApiError> {
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

pub(crate) fn save_last_opened_snapshot_to(
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

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn sample_snapshot() -> LastOpenedSnapshot {
        LastOpenedSnapshot {
            evaluation: super::super::CreateEvaluationResponse {
                evaluation_id: "eval-terminal".into(),
                status: "accepted".into(),
                accepted_at: Some("2026-01-01T00:00:00Z".into()),
            },
            evaluation_status: super::super::EvaluationStatusResponse {
                evaluation_id: "eval-terminal".into(),
                status: "success".into(),
                stage: None,
                progress_percent: None,
                message: None,
                exit_state: None,
                terminal: true,
            },
            evaluation_result: super::super::EvaluationResultResponse {
                evaluation_id: "eval-terminal".into(),
                status: "success".into(),
                summary: json!({ "score": 100 }),
            },
            artifacts: vec![super::super::ArtifactDescriptor {
                name: "normalized-report".into(),
                kind: "normalized_report".into(),
                media_type: "application/json".into(),
                download_url: Some("https://example.test/report.json".into()),
            }],
        }
    }

    #[test]
    fn validate_snapshot_rejects_non_terminal_status() {
        let mut snapshot = sample_snapshot();
        snapshot.evaluation_status.terminal = false;

        let error = validate_last_opened_snapshot(&snapshot).expect_err("non-terminal");

        assert_eq!(
            error.message,
            "Last-opened snapshot requires a terminal evaluation status."
        );
    }

    #[test]
    fn validate_snapshot_rejects_artifacts_with_empty_media_type() {
        let mut snapshot = sample_snapshot();
        snapshot.artifacts[0].media_type = "  ".into();

        let error = validate_last_opened_snapshot(&snapshot).expect_err("empty media type");

        assert_eq!(
            error.message,
            "Last-opened snapshot artifacts require name, kind, and media type."
        );
    }
}
