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

    def test_contract_identity_matches_backend_source_snapshot(self) -> None:
        info = self.document["info"]
        self.assertEqual(info["title"], "Stealth Lightbeacon Service API")
        self.assertEqual(info["version"], "1.2.7")
        self.assertIn("Canonical contract", info["description"])

    def test_operation_ids_remain_stable_for_desktop_adapter(self) -> None:
        paths = self.document["paths"]
        self.assertEqual(paths["/health"]["get"]["operationId"], "getHealth")
        self.assertEqual(paths["/capabilities"]["get"]["operationId"], "getCapabilities")
        self.assertEqual(paths["/evaluations"]["post"]["operationId"], "createEvaluation")
        self.assertEqual(
            paths["/evaluations/{evaluation_id}"]["get"]["operationId"],
            "getEvaluationStatus",
        )
        self.assertEqual(
            paths["/evaluations/{evaluation_id}/result"]["get"]["operationId"],
            "getEvaluationResult",
        )
        self.assertEqual(
            paths["/evaluations/{evaluation_id}/artifacts"]["get"]["operationId"],
            "getEvaluationArtifacts",
        )
        self.assertEqual(paths["/recon"]["post"]["operationId"], "runRecon")

    def test_required_response_codes_exist(self) -> None:
        paths = self.document["paths"]
        self.assertIn("200", paths["/health"]["get"]["responses"])
        self.assertIn("200", paths["/capabilities"]["get"]["responses"])
        self.assertIn("202", paths["/evaluations"]["post"]["responses"])
        self.assertIn("200", paths["/evaluations/{evaluation_id}"]["get"]["responses"])
        self.assertIn("200", paths["/evaluations/{evaluation_id}/result"]["get"]["responses"])
        self.assertIn(
            "200", paths["/evaluations/{evaluation_id}/artifacts"]["get"]["responses"]
        )
        self.assertIn("200", paths["/recon"]["post"]["responses"])


if __name__ == "__main__":
    unittest.main()
