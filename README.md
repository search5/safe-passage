# SafePassage

[English](README.md) | [한국어](README.ko.md)

📖 Full documentation: [https://search5.github.io/safe-passage/](https://search5.github.io/safe-passage/)

SafePassage is a secure, lightweight, and high-performance KeePass integration plugin for Obsidian. It allows you to link your local KeePass databases (`.kdbx`) to render masked credential chips and structured tables directly inside your notes, while keeping your master passwords secure.

---

## ✨ Key Features

- **High-Performance WebAssembly Engine**: Decrypts KeePass databases with blazing-fast speeds using WASM-based Argon2, ensuring zero UI freezing or Out-Of-Memory (OOM) crashes.
- **Cross-Platform Compliance (Desktop & Mobile)**: Database and key files are read and written through Obsidian's own Vault API, so the same Vault-relative paths work identically on desktop and mobile (iOS/Android).
- **Secure Master Keyring**: Caches master passwords in protected session memory for automatic background unlocking when opening protected notes.
- **Masked Inline Chips**: Automatically transforms `` `{{sp:profile/path#field}}` `` tags into elegant circular masking chips. Click to copy the secret value, with configurable clipboard auto-clear timeouts.
- **Interactive Credential Tables**: Render entire credential groups using code blocks, complete with customizable titles and dynamic inline lookups.
- **UUID Entry References**: Reference an entry by its permanent KeePass UUID instead of its `Group/Path`, so renaming or moving an entry never breaks a token that points to it. Path-based tokens keep working unchanged.
- **Autocomplete Everywhere**: Entry suggestions (title + full path) as you type — in the `Insert Secret` modal, directly while typing `{{sp:` in a note, and inside `safe-passage` code blocks — including a one-click unlock when the target profile is locked.
- **End-to-End Writing Command**: Insert new secrets into your KeePass database on-the-fly and auto-complete backtick-wrapped tokens via the `Insert Secret` command modal.

---

## 🚀 Installation & Setup

1. **Install the Plugin**: Build the plugin using `npm run build` and copy `main.js`, `manifest.json`, and `styles.css` into your vault's `.obsidian/plugins/safe-passage/` directory.
2. **Configure Database Profiles**:
   - Open Obsidian Settings -> **SafePassage**.
   - Click **Add New Profile**.
   - Fill in:
     - **Profile Name**: A friendly identifier (e.g., `work-db`).
     - **Database File Path**: Path to your `.kdbx` file, relative to this vault (e.g., `Secrets/vault.kdbx`).
     - **Key File Path (Optional)**: Path to your `.key` or `.keyx` file, relative to this vault.
     - **Session Expiry Lifetime**: Define when the memory session expires (e.g., Immediate lock, 5 minutes, 15 minutes, or forever).

---

## 💡 How to Use

### 1. Masked Inline Chips
Insert credential tokens anywhere in your note wrapped in backticks:
```markdown
My twitter password is `{{sp:work-db/SNS/Twitter#Password}}` and the username is `{{sp:work-db/SNS/Twitter#UserName}}`.
```
- **Locked State**: Shows as `work-db: Twitter#Password (🔒)`. Click to open the password unlock modal.
- **Unlocked State**: Displays as a masked chip showing the entry's full path, e.g. `Finance/API/Stripe (Password)`. Click to copy the value to your clipboard.

> **Note:** The `work-db` segment is the profile's internal ID, not its display name — SafePassage inserts it automatically when you save a secret (see below), so you never type it by hand. Because it's the ID rather than the name, renaming a profile later won't break tokens that were already inserted.

### 2. Referencing Entries by UUID

The part after the profile can be either a path (`Group/SubGroup/Title`) or a KeePass entry's UUID, prefixed with `uuid:`:

```
{{sp:work-db/uuid:Yhz3AjkUmk+HQu5+w2xdWQ==#Password}}
```

A UUID never changes even when the entry is renamed or moved to another group, so a UUID reference survives database reorganization where a path reference would break. Existing path-based tokens keep working exactly as before — nothing needs to be migrated.

### 3. Autocomplete

Since nobody types a UUID by hand, SafePassage suggests entries wherever a reference is entered:

- The **Insert Secret** modal's entry field suggests existing entries (title + full path) as you type.
- Typing `{{sp:` directly in a note triggers a chained autocomplete: profile → entry → field, automatically inserting the next separator as you go. If the target profile is locked, the suggestion list offers a one-click unlock instead of coming up empty.
- The same autocomplete applies to the `profile:` field and `entries:` list items inside `safe-passage` code blocks.

### 4. Credential Tables
Use the `safe-passage` markdown code blocks to render structured tables:
```yaml
```safe-passage
title: "Production Servers Access Control"
profile: work-db
fields: [UserName, Password, URL]
entries:
  - SSH-Prod/[Prod] bastion
  - uuid:Yhz3AjkUmk+HQu5+w2xdWQ==
```
```
This renders a sleek table displaying columns for each field and copy buttons for every entry. Entries can freely mix path and UUID references.

### 5. Inserting New Credentials (Write Support)
1. Open the Command Palette (`Cmd + P` or `Ctrl + P`).
2. Search and execute **`SafePassage: Insert Secret`**.
3. Choose a profile, type the entry path (e.g., `Database/MySQL`), and input the credentials. You can use the **[Generate]** button to instantly create a strong 16-character password.
4. Click **[Save]**. The credentials will be written directly to your physical `.kdbx` file, and the token `` `{{sp:work-db/Database/MySQL#Password}}` `` will be auto-inserted at your cursor location, using a UUID reference for that entry.

---

## 🔒 Security Design

- **Zero Plain-Text Storage**: Master passwords and database buffers are never saved to disk in plain text.
- **Memory Safety**: Decrypted database instances are stored in transient JavaScript heaps and cleaned up immediately upon session timeout.
- **Clipboard Sanitation**: Copied secrets are automatically cleared from your system clipboard after the duration configured in your settings.
- **Read-Only Mode**: Protect crucial databases by toggling "Read-Only" in the profile settings to block any write operations.

---

## 🛠 Developer Commands

For building and testing the codebase locally:

```bash
# Install dependencies
npm install

# Run build compilation
npm run build
```

---

## 📄 License
This project is licensed under the MIT License.
