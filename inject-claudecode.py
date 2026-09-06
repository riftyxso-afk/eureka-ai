#!/usr/bin/env python3
"""
OpenAgentic Config Injector for Claude Code
=============================================
Injects OpenAgentic as an API provider into Claude Code's settings.json
WITHOUT overwriting your other settings.

Usage:
  python3 inject-claudecode.py
  python3 inject-claudecode.py --api-key sk-your-key-here
  python3 inject-claudecode.py --remove

One-liner install:
  curl -fsSL https://openagentic.id/inject-claudecode.py | python3 - --api-key YOUR_KEY
"""

import json
import os
import sys
import shutil
from pathlib import Path
from datetime import datetime

# ─── Helpers ──────────────────────────────────────────────────────────────────

def get_claude_config_path():
    """Find Claude Code settings.json path (cross-platform)"""
    if sys.platform == "darwin":
        return Path.home() / ".claude" / "settings.json"
    elif sys.platform == "win32":
        appdata = os.environ.get("APPDATA", str(Path.home() / "AppData" / "Roaming"))
        return Path(appdata) / "claude" / "settings.json"
    else:
        return Path.home() / ".claude" / "settings.json"


def colored(text, color):
    """Simple ANSI color"""
    colors = {"green": "32", "yellow": "33", "red": "31", "cyan": "36", "bold": "1", "dim": "2"}
    code = colors.get(color, "0")
    return "\033[{}m{}\033[0m".format(code, text)


def print_banner():
    print()
    print(colored("╔══════════════════════════════════════════════════╗", "cyan"))
    print(colored("║   OpenAgentic Config Injector for Claude Code    ║", "cyan"))
    print(colored("║   https://openagentic.id                         ║", "cyan"))
    print(colored("╚══════════════════════════════════════════════════╝", "cyan"))
    print()


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Inject OpenAgentic provider into Claude Code settings")
    parser.add_argument("--api-key", help="Your OpenAgentic API key (from dashboard)")
    parser.add_argument("--config", help="Custom path to settings.json")
    parser.add_argument("--remove", action="store_true", help="Remove OpenAgentic provider from config")
    args = parser.parse_args()

    print_banner()

    # Determine config path
    config_path = Path(args.config) if args.config else get_claude_config_path()
    print("  Config: {}".format(colored(str(config_path), 'cyan')))

    # Load existing config or create new
    config = {}
    if config_path.exists():
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                config = json.load(f)
            print("  Status: {}".format(colored('Existing config found', 'green')))
        except json.JSONDecodeError as e:
            print("  {}".format(colored('Warning: Config has invalid JSON: {}'.format(e), 'red')))
            print("  {}".format(colored('  Creating backup and starting fresh...', 'yellow')))
            backup = config_path.with_suffix(".json.bak.{}".format(datetime.now().strftime('%Y%m%d%H%M%S')))
            shutil.copy2(config_path, backup)
            print("  Backup: {}".format(colored(str(backup), 'dim')))
            config = {}
    else:
        print("  Status: {}".format(colored('No existing config — creating new', 'yellow')))
        config_path.parent.mkdir(parents=True, exist_ok=True)

    # Handle --remove
    if args.remove:
        if "apiProviders" in config and "openagentic" in config["apiProviders"]:
            del config["apiProviders"]["openagentic"]
            if not config["apiProviders"]:
                del config["apiProviders"]
            with open(config_path, "w", encoding="utf-8") as f:
                json.dump(config, f, indent=2, ensure_ascii=False)
                f.write("\n")
            print("\n  {}".format(colored('✓ OpenAgentic provider removed from Claude Code', 'green')))
        else:
            print("\n  {}".format(colored('ℹ OpenAgentic provider not found in config', 'yellow')))
        return

    # Backup before modifying
    if config_path.exists():
        backup = config_path.with_suffix(".json.bak.{}".format(datetime.now().strftime('%Y%m%d%H%M%S')))
        shutil.copy2(config_path, backup)
        print("  Backup: {}".format(colored(str(backup), 'dim')))

    # Handle API key
    api_key = "YOUR_API_KEY_HERE"
    if args.api_key:
        api_key = args.api_key
    elif "apiProviders" in config and "openagentic" in config.get("apiProviders", {}):
        existing_key = config["apiProviders"]["openagentic"].get("apiKey", "")
        if existing_key and existing_key != "YOUR_API_KEY_HERE":
            api_key = existing_key
            print("  API Key: {}".format(colored('Preserved existing key', 'green')))
    else:
        print()
        try:
            key = input("  Enter your API key (or press Enter to skip): ").strip()
            if key:
                api_key = key
            else:
                print("  API Key: {}".format(colored('Skipped — edit config later to add your key', 'yellow')))
        except (EOFError, KeyboardInterrupt):
            print()
            print("  API Key: {}".format(colored('Skipped', 'yellow')))

    # Build the provider entry for Claude Code
    openagentic_provider = {
        "baseUrl": "https://openagentic.id/api/v1",
        "apiKey": api_key,
        "model": "claude-sonnet-4.5",
        "maxTokens": 64000,
        "promptCaching": True
    }

    # Ensure apiProviders dict exists
    if "apiProviders" not in config:
        config["apiProviders"] = {}

    # Check what's being updated
    if "openagentic" in config["apiProviders"]:
        print("\n  {}".format(colored('Updating OpenAgentic provider in Claude Code', 'green')))
    else:
        print("\n  {}".format(colored('+ Adding OpenAgentic provider to Claude Code', 'green')))

    # Inject provider (only touches config["apiProviders"]["openagentic"])
    config["apiProviders"]["openagentic"] = openagentic_provider

    # Show other providers (not touched)
    other_providers = [k for k in config.get("apiProviders", {}) if k != "openagentic"]
    if other_providers:
        print("  Other providers (untouched): {}".format(colored(', '.join(other_providers), 'dim')))

    # Write config
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print("\n  {} Config saved to {}".format(colored('✅ Done!', 'green'), config_path))
    print()
    print("  {}".format(colored("Quick start:", "bold")))
    print("    claude --provider openagentic")
    print()
    print("  {}".format(colored("Available models (use with --model flag):", "dim")))
    print("    claude-sonnet-4.5        (FREE)")
    print("    claude-sonnet-4.5-1m     (FREE, 1M context)")
    print("    claude-opus-4.6          (PRO)")
    print("    claude-opus-4.7          (PRO)")
    print("    claude-opus-4.8          (PRO)")
    print("    gpt-5.5                  (PRO)")
    print("    gemini-3.1-pro           (PRO)")
    print()
    print("  {}".format(colored("Full model list: https://openagentic.id/#models", "dim")))
    print()


if __name__ == "__main__":
    main()
