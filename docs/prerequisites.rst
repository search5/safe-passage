Prerequisites
=============

Before installing **SafePassage**, make sure the following are in place:

- `Obsidian <https://obsidian.md>`_ desktop or mobile app, version
  ``1.12.7`` or later.
- A KeePass database file (``.kdbx``) containing the credentials you want to
  reference from your notes, and optionally a key file (``.key`` /
  ``.keyx``).
- The database file (and key file, if any) must live inside your Obsidian
  vault, since SafePassage reads and writes them through Obsidian's own
  Vault API using vault-relative paths. This is also what makes the same
  configuration work identically on desktop and mobile.
- If you plan to install from source instead of from Obsidian's Community
  Plugins browser, `Node.js <https://nodejs.org/>`_ 18 or later.

Once these are available, continue to :doc:`installation`.
