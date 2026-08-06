# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Changed

- Newly-inserted `{{sp:...}}` tokens now embed the profile's internal ID instead of its display name, so renaming a profile in settings no longer breaks tokens created afterward. Tokens already written in existing notes are unaffected — the resolver still matches by name as a fallback, so old references keep working exactly as before.
