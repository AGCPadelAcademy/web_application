#!/usr/bin/env python3
"""Safely remove obsolete SDD migration metadata from GitHub Issues.

Default mode is dry-run. Set APPLY=1 to update the issues.
Required environment variables:
  GITHUB_TOKEN

Optional:
  GITHUB_REPOSITORY=AGCPadelAcademy/web_application
"""

from __future__ import annotations

import os
import re
import sys
from dataclasses import dataclass
from urllib.request import Request, urlopen
import json


REPOSITORY = os.getenv("GITHUB_REPOSITORY", "AGCPadelAcademy/web_application")
TOKEN = os.getenv("GITHUB_TOKEN")
APPLY = os.getenv("APPLY", "0") == "1"
TARGET_ISSUES = [*range(8, 30), 36, 54]


@dataclass
class Issue:
    number: int
    title: str
    body: str


def github(method: str, path: str, payload: dict | None = None):
    if not TOKEN:
        raise RuntimeError("GITHUB_TOKEN is required")
    url = f"https://api.github.com/repos/{REPOSITORY}{path}"
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {TOKEN}",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    request = Request(url, data=data, headers=headers, method=method)
    with urlopen(request) as response:
        return json.loads(response.read().decode("utf-8"))


def remove_obsolete_metadata(body: str) -> tuple[str, list[str]]:
    original = body
    removed: list[str] = []

    patterns = [
        (r"^\*\*Classification:\*\*.*\n", "Classification"),
        (r"^\*\*Spec Status:\*\*.*\n", "Spec Status"),
        (r"^\*\*Spec Path:\*\*.*\n", "Spec Path"),
    ]

    for pattern, label in patterns:
        body, count = re.subn(pattern, "", body, flags=re.MULTILINE)
        if count:
            removed.append(label)

    # Remove only the obsolete migration section, up to the next heading.
    body, count = re.subn(
        r"\n## Migration\n.*?(?=\n## |\Z)",
        "",
        body,
        flags=re.DOTALL,
    )
    if count:
        removed.append("Migration section")

    # Remove excess blank lines introduced by metadata removal, without
    # changing the substantive Markdown content.
    body = re.sub(r"\n{3,}", "\n\n", body).strip() + "\n"

    if body == original:
        return body, removed
    return body, removed


def main() -> int:
    if not TOKEN:
        print("GITHUB_TOKEN is required", file=sys.stderr)
        return 2

    changed = 0
    for number in TARGET_ISSUES:
        issue_data = github("GET", f"/issues/{number}")
        issue = Issue(number, issue_data["title"], issue_data.get("body") or "")
        new_body, removed = remove_obsolete_metadata(issue.body)

        if not removed:
            print(f"Issue #{number}: already clean")
            continue

        changed += 1
        print(f"Issue #{number} ({issue.title}): remove {', '.join(removed)}")
        if APPLY:
            github("PATCH", f"/issues/{number}", {"body": new_body})
            print(f"Issue #{number}: updated")

    mode = "applied" if APPLY else "dry-run"
    print(f"Completed {mode}: {changed} issue(s) would change or changed.")
    if not APPLY:
        print("Set APPLY=1 to apply the exact body-preserving transformation.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
