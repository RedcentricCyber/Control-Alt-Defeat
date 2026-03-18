#!/usr/bin/env python3
"""Auto-classify PT001 and PT002 questions with a 'skill' field based on keyword matching."""

import json
import re

INPUT_FILE = "/home/user/Control-Alt-Defeat/app/exams/CREST-CCT-Combined.json"

# Skill definitions: list of (skill_name, [keywords]) ordered by specificity (most specific first)
PT001_SKILLS = [
    ("Report QA", [
        "QA", "quality", "peer review", "proofread", "accuracy", "consistency", "check report",
    ]),
    ("Reporting", [
        "CVSS", "rating", "technical detail", "vulnerability description",
        "proof of concept", "PoC", "remediation", "report",
    ]),
    ("Reporting (Basic)", [
        "executive summary", "finding", "recommendation", "basic report",
    ]),
    ("Law and Compliance", [
        "law", "legal", "compliance", "regulation", "CMA", "GDPR", "legislation",
        "authority", "warrant", "criminal", "Computer Misuse Act", "data protection",
        "privacy", "lawful", "unlawful", "prosecut", "offence", "offense",
        "authorized", "unauthorised", "unauthorized",
    ]),
    ("Scoping", [
        "scope", "scoping", "rules of engagement", "RoE", "boundaries", "target",
        "IP range", "out of scope", "in scope", "boundary",
    ]),
    ("Managing Risk", [
        "risk", "impact", "severity", "critical", "likelihood", "threat",
        "mitigation", "remediation priority", "prioriti",
    ]),
    ("Client Communications", [
        "client", "stakeholder", "communication", "escalat", "notify", "inform",
        "update", "contact", "brief", "debrief",
    ]),
    ("Record Keeping", [
        "record", "log", "evidence", "document", "chain of custody", "screenshot",
        "note-taking", "artifact", "trail", "audit trail",
    ]),
    ("Platform Preparation", [
        "platform", "tool", "setup", "preparation", "lab", "environment",
        "configure", "VM", "test environment", "virtual machine",
    ]),
    ("Engagement Lifecycle", [
        "lifecycle", "engagement", "phase", "methodology", "process", "stages",
        "approach", "pre-engagement", "post-engagement",
    ]),
]

PT002_SKILLS = [
    ("Pivoting", [
        "pivot", "tunnel", "port forward", "lateral", "proxy", "SOCKS",
        "SSH tunnel", "jump host", "relay",
    ]),
    ("Cryptography", [
        "crypt", "cipher", "hash", "AES", "RSA", "encrypt", "decrypt",
        "TLS", "SSL", "certificate", "PKI", "key exchange", "HMAC", "SHA",
        "MD5", "DES", "CBC", "GCM", "asymmetric", "symmetric",
    ]),
    ("Hardware Security", [
        "hardware", "JTAG", "UART", "firmware", "chip", "IoT", "embedded",
        "flash", "bus", "SPI", "I2C", "debug port",
    ]),
    ("OS Fingerprinting", [
        "fingerprint", "OS detection", "TTL", "TCP window", "banner grab",
        "identify operating system", "operating system detection",
    ]),
    ("Using Tools and Interpreting Output", [
        "tool", "output", "interpret", "nmap", "scan result", "parse",
        "analyze", "Burp", "Wireshark", "Metasploit", "script", "command",
        "enumerat", "reconnaiss", "exploit",
    ]),
]

CATEGORY_SKILLS = {
    "Soft Skills and Assessment Management (PT001)": PT001_SKILLS,
    "Core Technical Skills (PT002)": PT002_SKILLS,
}

# Default/fallback skill for each category
CATEGORY_DEFAULTS = {
    "Soft Skills and Assessment Management (PT001)": "Engagement Lifecycle",
    "Core Technical Skills (PT002)": "Using Tools and Interpreting Output",
}


def build_searchable_text(q: dict) -> str:
    """Combine all question text fields into one searchable string."""
    parts = [
        q.get("question", ""),
        q.get("explanation", ""),
    ]
    options = q.get("options", {})
    for key in sorted(options.keys()):
        parts.append(options[key])
    return " ".join(parts)


def classify_question(q: dict, skills: list, default: str) -> str:
    """Return the best matching skill for a question."""
    text = build_searchable_text(q)

    best_skill = None
    best_count = 0

    for skill_name, keywords in skills:
        count = 0
        for kw in keywords:
            # Case-insensitive search; use word boundary for short keywords
            if len(kw) <= 3:
                pattern = re.compile(r'\b' + re.escape(kw) + r'\b', re.IGNORECASE)
            else:
                pattern = re.compile(re.escape(kw), re.IGNORECASE)
            if pattern.search(text):
                count += 1
        if count > best_count:
            best_count = count
            best_skill = skill_name

    return best_skill if best_skill else default


def main():
    with open(INPUT_FILE) as f:
        data = json.load(f)

    pt001_count = 0
    pt002_count = 0
    skill_counts = {}

    for q in data["questions"]:
        cat = q["category"]
        if cat not in CATEGORY_SKILLS:
            continue

        skill = classify_question(q, CATEGORY_SKILLS[cat], CATEGORY_DEFAULTS[cat])
        q["skill"] = skill

        if "PT001" in cat:
            pt001_count += 1
        else:
            pt002_count += 1

        key = f"{cat} -> {skill}"
        skill_counts[key] = skill_counts.get(key, 0) + 1

    print(f"Classified {pt001_count} PT001 questions and {pt002_count} PT002 questions.")
    print(f"Total questions in file: {len(data['questions'])}")
    print("\nSkill distribution:")
    for key in sorted(skill_counts.keys()):
        print(f"  {skill_counts[key]:4d}  {key}")

    with open(INPUT_FILE, "w") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"\nWritten updated file to {INPUT_FILE}")


if __name__ == "__main__":
    main()
