Troubleshooting & FAQ
======================

"Database file not found in vault: ..."
--------------------------------------------

The **Database File Path** in the profile is resolved relative to the
current vault's root. Make sure:

- The path does not include the vault's own folder name or a leading
  ``/``.
- The ``.kdbx`` file has actually been added to (or synced into) the vault
  — SafePassage can only read files through Obsidian's Vault API, not
  arbitrary paths on disk.

The same applies to **"Key file not found in vault: ..."** for the
optional key file path.

A chip shows "Missing Profile" or "Missing Entry"
-------------------------------------------------------

- **Missing Profile** means the ``<profile>`` segment of the
  ``{{sp:<profile>/<entry>#<field>}}`` token does not match any configured
  profile ID. Check **Settings → SafePassage** for the exact profile name.
- **Missing Entry** means the profile was found and unlocked, but no entry
  exists at the given group/title path. Entry paths are case-sensitive and
  must match the KeePass group structure exactly (e.g.
  ``SSH-Prod/[Prod] bastion``).
- **Missing Field** means the entry was found, but it has no field with
  that exact name (fields are also case-sensitive, e.g. ``UserName`` vs
  ``Username``).

A chip stays locked even though I unlocked that profile before
----------------------------------------------------------------------

This is expected once the profile's **Session Expiry Lifetime** has
elapsed — the database is removed from memory and must be unlocked again.
If you don't want the database to lock so aggressively, increase the
lifetime (or set it to **Until Obsidian closes**) in the profile's
settings. See :doc:`usage`.

If the profile has **Manage with Master Keyring** enabled and the global
**Enable Master Keyring** setting is also on, SafePassage tries to
re-unlock it silently using the cached password instead of prompting —
if that also stopped working, the cached password itself may have expired
along with the previous session.

Writing a new secret fails
--------------------------------

- **"Cannot add or modify data on a read-only profile."** — the target
  profile has **Read-Only** enabled in its settings. Disable it if you
  need to write to that database, or choose a different, writable profile
  in the **Insert Secret** dialog.
- **"The database is locked."** — unlock the profile first (click any
  chip for that profile, or use the **Unlock a specific profile**
  command), then retry.
- **"Entry Path, Username, and Password are required."** — these three
  fields must be filled in before saving; other fields (Notes, custom
  fields) are optional.

Clipboard is not clearing automatically
---------------------------------------------

Check **Clipboard Clear Timeout (seconds)** under **Global Security &
Clipboard Settings**. A value of ``0`` disables auto-clear entirely. If it
is set to a non-zero value but the clipboard still isn't cleared, note that
the clear is skipped if the clipboard's contents no longer match what
SafePassage copied — for example if you copied something else in the
meantime.

The plugin freezes briefly when unlocking a large database
------------------------------------------------------------------

Argon2 key derivation for KDBX4 databases is intentionally slow (that is
what makes brute-forcing the master password expensive). SafePassage runs
this through a WebAssembly Argon2 implementation specifically to avoid
freezing Obsidian's UI thread — see :doc:`architecture`. If unlocking is
still noticeably slow, this usually reflects your KeePass database's own
Argon2 memory/iteration parameters (configurable in your KeePass client's
database security settings) rather than a SafePassage-specific issue.

The plugin does not appear after building from source
-------------------------------------------------------------

Make sure ``main.js``, ``manifest.json``, and ``styles.css`` were copied
into ``<your-vault>/.obsidian/plugins/safe-passage/`` (not just built in
the repository checkout), then restart Obsidian and enable **SafePassage**
under **Settings → Community plugins**. See :doc:`installation`.
