"""Current production policy: first-exemplar cosine distance, not a moving centroid."""

import math

DISTANCE_THRESHOLD = 0.22
POLICY_VERSION = "first-exemplar-cosine-v1"


def should_merge(distance, threshold=DISTANCE_THRESHOLD):
    return math.isfinite(distance) and distance < threshold
