import re
from typing import Optional

# Matches "Siri 10", "Siri 03", "siri: 7" — the number must follow the word directly.
SERIES_REGEX = re.compile(r"\bsiri\s*[:#.\-]?\s*(\d{1,4})\b", re.IGNORECASE)

MIN_SERIES_NUMBER = 1
MAX_SERIES_NUMBER = 9999

def parse_series_number(title: Optional[str]) -> Optional[int]:
    """Return N from the first "Siri N" in a title, or None when absent/out of range."""
    if not title:
        return None
    match = SERIES_REGEX.search(title)
    if not match:
        return None
    number = int(match.group(1))
    return number if MIN_SERIES_NUMBER <= number <= MAX_SERIES_NUMBER else None
