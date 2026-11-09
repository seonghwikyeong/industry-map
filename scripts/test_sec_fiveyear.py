"""Offline regression fixtures for 5-year SEC XBRL quarter construction."""
import importlib.util
import pathlib
import unittest

PATH = pathlib.Path(__file__).with_name("build_sec_fiveyear.py")
spec = importlib.util.spec_from_file_location("sec_fiveyear", PATH)
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

def fact(start, end, val, form="10-Q", filed=None):
    from datetime import date, timedelta
    filed = filed or min(date.fromisoformat(end) + timedelta(days=40), m.AS_OF).isoformat()
    d = {"end": end, "val": val, "form": form, "filed": filed,
         "accn": "0000000000-26-000001"}
    if start:
        d["start"] = start
    return d

def facts(values, unit="USD"):
    return {"units": {unit: values}}

class BuilderTests(unittest.TestCase):
    def setUp(self):
        base = [
            fact("2025-01-01", "2025-03-31", 10_000_000),
            fact("2025-01-01", "2025-06-30", 30_000_000),
            fact("2025-01-01", "2025-09-30", 60_000_000),
            fact("2025-01-01", "2025-12-31", 100_000_000, "10-K"),
            fact("2026-01-01", "2026-03-31", 25_000_000),
            fact("2026-01-01", "2026-06-30", 80_000_000),
        ]
        self.revenue = base

    def test_ytd_and_q4_derived_and_source(self):
        d = {"facts": {"us-gaap": {"Revenues": facts(self.revenue)}}}
        out = m.company_series(d, 123)
        vals = {p["end"]: p for p in out["revenue"]["points"]}
        self.assertEqual(vals["2025-03-31"]["value"], 10)
        self.assertEqual(vals["2025-06-30"]["value"], 20)
        self.assertEqual(vals["2025-09-30"]["value"], 30)
        self.assertEqual(vals["2025-12-31"]["value"], 40)
        self.assertEqual(vals["2026-03-31"]["value"], 25)
        self.assertEqual(vals["2026-06-30"]["value"], 55)
        self.assertEqual(vals["2025-12-31"]["kind"], "derived")
        self.assertIn("www.sec.gov/Archives/edgar/data/123/", vals["2025-12-31"]["source"])

    def test_eps_quarters_not_derived_from_annual(self):
        eps = [
            fact("2025-01-01", "2025-03-31", 1.0),
            fact("2025-04-01", "2025-06-30", 1.1),
            fact("2025-07-01", "2025-09-30", 1.2),
            fact("2025-01-01", "2025-12-31", 4.5, "10-K"),
        ]
        d = {"facts": {"us-gaap": {"EarningsPerShareDiluted": facts(eps, "USD/shares")}}}
        out = m.company_series(d, 123)
        points = out["eps"]["points"]
        self.assertEqual(len(points), 3)
        self.assertTrue(all(p["kind"] == "reported" for p in points))

    def test_deny_filing_from_future(self):
        raw = [
            fact("2025-01-01", "2025-03-31", 10_000_000),
            fact("2025-04-01", "2025-06-30", 20_000_000),
            fact("2025-07-01", "2025-09-30", 999_000_000, filed="2027-04-15"),
        ]
        d = {"facts": {"us-gaap": {"NetIncomeLoss": facts(raw)}}}
        out = m.company_series(d, 123)
        self.assertEqual(len(out["netIncome"]["points"]), 2)

    def test_balance_sheet_instant(self):
        raw = [
            fact(None, "2025-03-31", 120_000_000),
            fact(None, "2025-06-30", 130_000_000),
            fact(None, "2025-09-30", 140_000_000),
        ]
        d = {"facts": {"us-gaap": {"Assets": facts(raw)}}}
        out = m.company_series(d, 123)
        self.assertEqual(len(out["assets"]["points"]), 3)
        self.assertEqual(out["assets"]["unit"], "USD million")

if __name__ == "__main__":
    unittest.main()
