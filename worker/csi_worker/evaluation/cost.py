"""Explicit infrastructure assumptions; never interpret local inference as free."""

import argparse
import json
import math
from pathlib import Path


def calculate(inputs):
    required = [
        "currency",
        "serverHourlyPrice",
        "provisionedHoursPerMonth",
        "targetUtilization",
        "measuredCallsPerHour",
        "storageGB",
        "storagePricePerGBMonth",
        "otherMonthlyCost",
    ]
    if any(k not in inputs for k in required):
        raise ValueError("All price, throughput and utilization assumptions are required")
    for key in required[1:]:
        value = inputs[key]
        if (
            isinstance(value, bool)
            or not isinstance(value, (int, float))
            or not math.isfinite(value)
            or value < 0
        ):
            raise ValueError("Assumptions must be finite nonnegative numbers")
    if not isinstance(inputs["currency"], str) or not inputs["currency"].strip():
        raise ValueError("Currency is required")
    if (
        not 0 < inputs["targetUtilization"] <= 1
        or inputs["measuredCallsPerHour"] <= 0
        or inputs["provisionedHoursPerMonth"] <= 0
    ):
        raise ValueError("Hours and throughput must be positive, utilization in (0,1]")
    calls = inputs["provisionedHoursPerMonth"] * inputs["targetUtilization"] * inputs["measuredCallsPerHour"]
    total = (
        inputs["serverHourlyPrice"] * inputs["provisionedHoursPerMonth"]
        + inputs["storageGB"] * inputs["storagePricePerGBMonth"]
        + inputs["otherMonthlyCost"]
    )
    duration = inputs.get("meanAudioSecondsPerCall")
    if duration is not None and (
        isinstance(duration, bool)
        or not isinstance(duration, (int, float))
        or not math.isfinite(duration)
        or duration <= 0
    ):
        raise ValueError("Mean audio duration must be finite and positive")
    audio_hours = calls * duration / 3600 if duration is not None else None
    return dict(
        assumptions=inputs,
        estimatedMonthlyCost=total,
        estimatedMonthlyCalls=calls,
        estimatedCostPerCall=total / calls,
        estimatedMonthlyAudioHours=audio_hours,
        estimatedCostPerAudioHour=total / audio_hours if audio_hours else None,
        limitation="Scenario calculation, not a measured bill. Match hardware and workload to the measured throughput. Include electricity, amortization, operations and backups in supplied prices. No prices are inferred.",
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("assumptions", type=Path)
    args = parser.parse_args()
    print(json.dumps(calculate(json.loads(args.assumptions.read_text())), indent=2))


if __name__ == "__main__":
    main()
