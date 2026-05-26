from __future__ import annotations

import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONTRACT = ROOT / "contracts" / "backend-api.openapi.json"


class BackendOpenApiContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.document = json.loads(CONTRACT.read_text())

    def test_required_phase_scaffold_endpoints_exist(self) -> None:
        paths = self.document["paths"]
        self.assertIn("/health", paths)
        self.assertIn("/capabilities", paths)
        self.assertIn("/evaluations", paths)
        self.assertIn("/evaluations/{evaluation_id}", paths)
        self.assertIn("/evaluations/{evaluation_id}/result", paths)
        self.assertIn("/evaluations/{evaluation_id}/artifacts", paths)
        self.assertIn("/recon", paths)

    def test_required_component_schemas_exist(self) -> None:
        schemas = self.document["components"]["schemas"]
        required = {
            "HealthResponse",
            "ApiModeResponse",
            "CapabilitiesResponse",
            "CreateEvaluationRequest",
            "CreateEvaluationResponse",
            "EvaluationStatusResponse",
            "EvaluationResultResponse",
            "ArtifactDescriptor",
            "ReconRequest",
            "ReconResponse",
            "ApiError",
        }
        self.assertTrue(required.issubset(set(schemas)))

    def test_create_evaluation_contract_uses_request_and_response_models(self) -> None:
        operation = self.document["paths"]["/evaluations"]["post"]
        schema_ref = operation["requestBody"]["content"]["application/json"]["schema"]["$ref"]
        self.assertEqual(schema_ref, "#/components/schemas/CreateEvaluationRequest")

        accepted_ref = operation["responses"]["202"]["content"]["application/json"]["schema"]["$ref"]
        self.assertEqual(accepted_ref, "#/components/schemas/CreateEvaluationResponse")


if __name__ == "__main__":
    unittest.main()
