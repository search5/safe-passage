Architecture
============

This page describes the internal design of **SafePassage** and the
reasoning behind its key implementation choices.

WebAssembly Argon2 engine
-----------------------------

KeePass KDBX4 databases derive their master key using Argon2, which is
computationally expensive by design. SafePassage registers a
`hash-wasm <https://github.com/Daninet/hash-wasm>`_-backed Argon2
implementation with ``kdbxweb``'s crypto engine, so the key derivation runs
as WebAssembly instead of pure JavaScript. This keeps large iteration/memory
parameters from freezing Obsidian's UI thread or exhausting memory on
lower-powered devices such as phones and tablets.

Vault-relative file access
------------------------------

Database and key files are read and written exclusively through Obsidian's
``Vault`` API (``vault.readBinary`` / ``vault.modifyBinary``) using
vault-relative, normalized paths — never Node's ``fs`` module directly.
Because the Vault API abstracts over the underlying storage, the exact same
profile configuration (a path like ``Secrets/vault.kdbx``) resolves
correctly on desktop and on mobile (iOS/Android), where the plugin has no
direct filesystem access.

In-memory session keyring
------------------------------

Unlocked databases are kept in a ``Map`` inside ``KdbxService``, keyed by
profile ID, entirely in JavaScript heap memory — never written to disk.
Master passwords typed into the unlock modal are cached the same way in
``KeyringService`` so a profile can be silently re-unlocked in the
background (for example when a note with an inline chip is opened again)
without re-prompting the user, for as long as its session is alive.

Session expiry and locking
-------------------------------

``SessionService`` runs a ``setTimeout`` per unlocked profile based on the
profile's **Session Expiry Lifetime** setting: immediate (locks again after
a single lookup), 5 minutes, 15 minutes, or indefinitely until Obsidian
closes or the profile is locked manually. When a timer fires, the
corresponding entry is removed from both the active-database map and the
in-memory keyring, so its secrets stop being reachable from that point on.

Protected field values
---------------------------

Sensitive KeePass fields (passwords, and any field marked "protected" in
the database) are wrapped by ``kdbxweb`` in a ``ProtectedValue`` container
rather than being kept as a plain string. SafePassage calls
``ProtectedValue.getText()`` only at the point a value is actually needed —
to render a masked chip's copy action, to populate a table cell, or to
write a new entry — and does not retain the decoded plain string beyond
that call.

Clipboard sanitation
-------------------------

When a secret is copied to the clipboard, ``ClipboardService`` starts a
timer (length configurable per profile) and remembers the exact value it
wrote. When the timer fires, it first re-reads the clipboard and only
overwrites it with an empty string if the contents still match what
SafePassage copied — so a value the user has since replaced with something
else is never clobbered.

Inline chip and table rendering
------------------------------------

Notes reference secrets through two mechanisms that both resolve against
the same ``KdbxService``:

- Inline tokens (``{{sp:<profile>/<entry>#<field>}}``) are matched by a
  CodeMirror decoration in Live Preview and by a Markdown post-processor in
  Reading view, both rendering the same masked chip component.
- ``safe-passage`` fenced code blocks are handled by a dedicated block
  processor that parses the YAML body and renders a full credential table.

Both paths only ever display a masked placeholder in the DOM; the
underlying secret is fetched from ``KdbxService`` on demand — for example
when the user clicks a chip to copy its value — rather than being embedded
in the rendered HTML.
