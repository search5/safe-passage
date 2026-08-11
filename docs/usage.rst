Usage
=====

Setting up a database profile
-------------------------------

#. Open **Settings → SafePassage**.
#. Click **Add New Profile** and fill in:

   .. list-table::
      :header-rows: 1

      * - Field
        - Description
      * - Profile Name
        - A friendly identifier, e.g. ``work-db``.
      * - Database File Path
        - Path to your ``.kdbx`` file, relative to this vault, e.g.
          ``Secrets/vault.kdbx``.
      * - Key File Path (Optional)
        - Path to your ``.key`` or ``.keyx`` file, relative to this vault.
      * - Session Expiry Lifetime
        - How long the unlocked database stays in memory: **Immediate
          lock** (locks again right after a single lookup), **5 minutes**,
          **15 minutes**, or **Forever** (until Obsidian closes or you lock
          it manually).

You can add multiple profiles to reference more than one KeePass database
from the same vault. Toggling **Read-Only** on a profile blocks all writes
(entry inserts) against it, and **Manage with Master Keyring** controls
whether that profile's password is cached for automatic unlocking — this
only takes effect if the global **Enable Master Keyring** switch under
**Global Security & Clipboard Settings** is also turned on.

Masked inline chips
---------------------

Insert credential tokens anywhere in your note wrapped in backticks:

.. code-block:: markdown

   My twitter password is `{{sp:work-db/SNS/Twitter#Password}}` and the
   username is `{{sp:work-db/SNS/Twitter#UserName}}`.

The token format is ``{{sp:<profile>/<reference>#<field>}}``.

The ``<profile>`` segment is the profile's internal ID rather than its
display name — SafePassage inserts it automatically when you save a secret
(see *Inserting new credentials* below), so you never type it by hand.
Because it's the ID and not the name, renaming a profile later doesn't
break tokens that were already inserted.

- **Locked state**: renders as ``work-db: Twitter#Password (🔒)``. Click it
  to open the unlock modal and enter the database's master password.
- **Unlocked state**: renders as a masked chip showing the entry's full
  path, e.g. ``Finance/API/Stripe (Password)``. Click it to copy the value
  to your clipboard.

Referencing entries by UUID
--------------------------------

The ``<reference>`` segment can be either a path (``Group/SubGroup/Title``)
or a KeePass entry's UUID, prefixed with ``uuid:``:

.. code-block:: text

   {{sp:work-db/uuid:Yhz3AjkUmk+HQu5+w2xdWQ==#Password}}

Every KeePass entry has a UUID that never changes, even when the entry is
renamed or moved to a different group. A UUID reference therefore survives
database reorganization, while a path reference breaks as soon as the entry
moves. The ``uuid:`` prefix is required — it's what lets SafePassage tell
path references and UUID references apart unambiguously — and existing
path-based tokens keep working exactly as before; nothing needs to be
migrated.

Since a UUID isn't something you'd type by hand, SafePassage never expects
you to write one directly — see *Autocomplete* below.

Autocomplete
-----------------

Typing a token by hand only gets you as far as the profile and field names
you already remember; SafePassage fills in the rest as you type, in three
places:

- **Insert Secret modal**: the entry field suggests existing entries (title
  and full path) as you type. Picking a suggestion fills in the matching
  entry's path, and the token inserted after saving defaults to a UUID
  reference for that entry.
- **Directly in a note**: typing ``{{sp:`` triggers a chained
  autocomplete — first the profile (by ID or name), then, after ``/``, the
  entry (by title, showing its full path), then, after ``#``, the field
  name. Picking an entry inserts a UUID reference and automatically types
  the next separator (``/``, ``#``, or the closing ``}}``) for you. If the
  target profile is locked, the suggestion list shows a lock entry that
  unlocks it in place instead of coming up empty.
- **``safe-passage`` code blocks**: the same autocomplete applies to the
  ``profile:`` field and to items under ``entries:``.

Credential tables
--------------------

Use ``safe-passage`` code blocks to render a structured table of several
entries at once:

.. code-block:: text

   ```safe-passage
   title: "Production Servers Access Control"
   profile: work-db
   fields: [UserName, Password, URL]
   entries:
     - SSH-Prod/[Prod] bastion
     - uuid:Yhz3AjkUmk+HQu5+w2xdWQ==
   ```

This renders a table with one column per field in ``fields`` and a copy
button for every entry. Entries can mix path references and UUID
references freely, and both the ``profile:`` field and each line under
``entries:`` support the autocomplete described above.

Inserting new credentials
-----------------------------

You can add a new entry to your KeePass database without leaving Obsidian:

#. Open the Command Palette (``Cmd/Ctrl + P``).
#. Run **SafePassage: Insert Secret**.
#. Choose a profile, type the entry path (e.g. ``Database/MySQL``), and fill
   in the credential fields. Use **[Generate]** to create a strong
   16-character password.
#. Click **[Save]**.

The credentials are written directly to the ``.kdbx`` file, and the token
`` `{{sp:work-db/Database/MySQL#Password}}` `` is inserted at your cursor
automatically.

Clipboard behavior
----------------------

When you copy a value from a chip or a table, SafePassage can automatically
clear it from your system clipboard after **Clipboard Clear Timeout
(seconds)**, a global setting under **Global Security & Clipboard
Settings** (set it to ``0`` to disable auto-clear). The clear only happens
if the clipboard still contains the exact value SafePassage copied — so it
never wipes out something else you copied in the meantime.

Locking a database
----------------------

A profile's database locks automatically once its **Session Expiry
Lifetime** elapses. You can also lock every profile immediately by running
**SafePassage: Lock all SafePassage profiles** from the Command Palette,
which is useful before stepping away from your machine.
