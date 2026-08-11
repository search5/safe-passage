# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

## [0.1.12] - 2026-08-12

### Added

- KeePass entries can now be referenced by UUID (`uuid:<base64>`) instead of
  only by `Group/Path`, e.g. `{{sp:work-db/uuid:Yhz3AjkUmk+HQu5+w2xdWQ==#Password}}`.
  Renaming or moving an entry no longer breaks a token that references it.
  The `uuid:` prefix is explicit, so path and UUID references parse
  unambiguously; existing `Group/Path` tokens and `entries:` list items keep
  working unchanged.
- Autocomplete for the entry field in the **Insert Secret** modal — suggests
  existing entries (title + full path) as you type, and defaults new saves
  to a UUID reference.
- Full editor autocomplete for `{{sp:profileId/reference#Field}}` tokens
  typed directly into a note: profile → entry → field name, chaining
  automatically as you type and inserting the right separator each step. If
  the target profile is locked, the suggestion list offers a one-click
  unlock instead of just coming up empty.
- The same autocomplete for the `profile:` field and `entries:` list items
  inside `safe-passage` code blocks, including a fix so that pressing Enter
  at the end of an `entries:` list item continues the list at the same
  indentation (Obsidian's list auto-indent was otherwise mistaking the code
  fence's `- ` lines for a real Markdown list and add two more spaces of
  indentation on every line).

### Changed

- Chips and the `safe-passage` code block table now show an entry's full
  path (e.g. `Finance/API/Stripe`) instead of just its title, so entries
  that share a title under different groups are distinguishable.
- Newly-inserted `{{sp:...}}` tokens now embed the profile's internal ID
  instead of its display name, so renaming a profile in settings no longer
  breaks tokens created afterward. Tokens already written in existing notes
  are unaffected — the resolver still matches by name as a fallback, so old
  references keep working exactly as before.

### Fixed

- Unlocking a profile referenced by more than one element in the same note
  (a chip and a code block table, for example) no longer prompts for the
  master password twice — concurrent unlock attempts for the same profile
  now share a single in-flight request instead of each opening their own
  prompt.
- Pressing Tab inside this plugin's Settings tab now moves focus to the next
  field, as expected. (Obsidian's own Settings modal otherwise intercepts Tab
  and repurposes it as row-jump navigation; this plugin now stops that
  interception from reaching it.)
