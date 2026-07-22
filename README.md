# SafePassage

SafePassage is a secure, lightweight, and high-performance KeePass integration plugin for Obsidian. It allows you to link your local KeePass databases (`.kdbx`) to render masked credential chips and structured tables directly inside your notes, while keeping your master passwords secure.

---

## ✨ Key Features

- **High-Performance WebAssembly Engine**: Decrypts KeePass databases with blazing-fast speeds using WASM-based Argon2, ensuring zero UI freezing or Out-Of-Memory (OOM) crashes.
- **Cross-Platform Compliance (Desktop & Mobile)**: 
  - **Desktop**: Allows loading and saving `.kdbx` or Key files from any **local absolute path** outside your Obsidian Vault (using lazy-loaded NodeJS I/O).
  - **Mobile (iOS/Android)**: Safely ignores desktop-only NodeJS dependencies to load databases via Vault-relative paths without runtime crashes.
- **Secure Master Keyring**: Caches master passwords in protected session memory for automatic background unlocking when opening protected notes.
- **Masked Inline Chips**: Automatically transforms `` `{{sp:profile/path#field}}` `` tags into elegant circular masking chips. Click to copy the secret value, with configurable clipboard auto-clear timeouts.
- **Interactive Credential Tables**: Render entire credential groups using code blocks, complete with customizable titles and dynamic inline lookups.
- **End-to-End Writing Command**: Insert new secrets into your KeePass database on-the-fly and auto-complete backtick-wrapped tokens via the `Insert Secret` command modal.

---

## 🚀 Installation & Setup

1. **Install the Plugin**: Build the plugin using `npm run build` and copy `main.js`, `manifest.json`, and `styles.css` into your vault's `.obsidian/plugins/safe-passage/` directory.
2. **Configure Database Profiles**:
   - Open Obsidian Settings -> **SafePassage**.
   - Click **Add New Profile**.
   - Fill in:
     - **Profile Name**: A friendly identifier (e.g., `work-db`).
     - **Database File Path**: The local absolute path (e.g., `/Users/username/Secure/vault.kdbx`).
     - **Key File Path (Optional)**: Path to your `.key` or `.keyx` file.
     - **Session Expiry Lifetime**: Define when the memory session expires (e.g., Immediate lock, 5 minutes, 15 minutes, or forever).

---

## 💡 How to Use

### 1. Masked Inline Chips
Insert credential tokens anywhere in your note wrapped in backticks:
```markdown
My twitter password is `{{sp:work-db/SNS/Twitter#Password}}` and the username is `{{sp:work-db/SNS/Twitter#UserName}}`.
```
- **Locked State**: Shows as `work-db: Twitter#Password (🔒)`. Click to open the password unlock modal.
- **Unlocked State**: Displays as a masked chip (`••••••••`). Click to copy the value to your clipboard.

### 2. Credential Tables
Use the `safe-passage` markdown code blocks to render structured tables:
```yaml
```safe-passage
title: "Production Servers Access Control"
profile: work-db
fields: [UserName, Password, URL]
entries:
  - SSH-Prod/[Prod] bastion
  - AWS/Admin
```
```
This renders a sleek table displaying columns for each field and copy buttons for every entry.

### 3. Inserting New Credentials (Write Support)
1. Open the Command Palette (`Cmd + P` or `Ctrl + P`).
2. Search and execute **`SafePassage: Insert Secret`**.
3. Choose a profile, type the entry path (e.g., `Database/MySQL`), and input the credentials. You can use the **[Generate]** button to instantly create a strong 16-character password.
4. Click **[Save]**. The credentials will be written directly to your physical `.kdbx` file, and the token `` `{{sp:work-db/Database/MySQL#Password}}` `` will be auto-inserted at your cursor location.

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
