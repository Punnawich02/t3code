# T3 Code (Custom Provider fork)

This is a fork of [T3 Code](https://github.com/pingdotgg/t3code) by T3 Tools Inc. (`pingdotgg/t3code`), the open source "agent harness control surface" for Codex, Claude Code, Cursor, Grok Build, OpenCode and Google Antigravity. It keeps upstream's server, web, desktop and mobile apps and is based on upstream commit `1451e7cb2`. Credit for the base project goes to the T3 Code maintainers. It stays under the MIT license in [LICENSE](./LICENSE).

The fork adds the ability to point T3 Code at inference servers that are not one of the built-in providers.

## What this fork adds

- **Custom Provider.** Connect any OpenAI-compatible endpoint (Ollama, LM Studio, vLLM, a hosted gateway, ...) from **Settings → Providers → Add provider → Custom Provider**. You enter a Base URL and an optional API key. Models are discovered from `/v1/models`. Under the hood it runs T3 Code's managed Codex against that endpoint, and T3 Code downloads Codex itself if it is missing. See [docs/user/providers-custom.md](./docs/user/providers-custom.md).
- **Connection method in Add provider.** The dialog first asks how to connect: **Sign in** (a CLI, app or account you already have) or **API key** (Claude API, OpenAI API, Gemini API or any OpenAI-compatible endpoint). Claude instances can use an Anthropic API key with their own config directory, so a signed-in Claude and a Claude API instance can run side by side. See [docs/user/install.md](./docs/user/install.md#providers) and [docs/user/providers-claude.md](./docs/user/providers-claude.md).

Everything else behaves like upstream. Upstream's documentation index is under [Documentation](#documentation).

## Installing

This fork does not publish releases, so you build the desktop app yourself (next section). Do not use the `curl ... t3.codes/install.sh`, `winget`, `scoop`, `brew` or AUR installs from upstream's README; those install upstream's build, without the features above.

You still need at least one provider to chat with. For Custom Provider that is just a running endpoint, for example Ollama on `http://localhost:11434/v1`. Give it a context window of at least 32k tokens.

## Building the desktop app

### Common requirements (all OS)

| Requirement                 | Notes                                                                                                                   |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Git                         | To clone the repository.                                                                                                |
| Node.js 24 (`^24.13.1`)     | Enforced by `engines` in `package.json`. The `vp` tool below can supply it.                                             |
| `vp` (Vite+)                | The task runner and package manager front end. `pnpm@11` is selected automatically through `packageManager`.            |
| Rust 1.85 or newer (rustup) | Builds the native resource monitor. Use [rustup](https://rustup.rs), not the distro package: it needs the 2024 edition. |
| ~5 GB free disk, internet   | Dependencies are large, and electron-builder downloads Electron and packaging tools.                                    |

Install `vp`:

```bash
# macOS / Linux
curl -fsSL https://vite.plus | bash
```

```powershell
# Windows (PowerShell)
irm https://vite.plus/ps1 | iex
```

Get the source and dependencies (the same on every OS):

```bash
git clone https://github.com/Punnawich02/t3code.git
cd t3code
vp i
```

Each OS builds its own installer. A Linux host cannot build the macOS or Windows app, and the reverse. Output goes to `release/`.

### Linux (AppImage and `.deb`)

Build on Linux: the browser-secret helper links against the host's libsecret.

```bash
# Ubuntu / Debian
sudo apt-get update
sudo apt-get install build-essential libsecret-1-dev pkg-config imagemagick
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh   # then open a new shell

# Fedora
sudo dnf install gcc gcc-c++ make libsecret-devel pkgconf-pkg-config ImageMagick

# Arch
sudo pacman -S base-devel libsecret pkgconf imagemagick
# then install Rust with rustup as above
```

Build and install:

```bash
vp run dist:desktop:linux
```

This produces an AppImage and a `.deb` in `release/`.

```bash
# Debian / Ubuntu
sudo apt install ./release/T3-Code-*.deb

# any distro
chmod +x release/T3-Code-*.AppImage && ./release/T3-Code-*.AppImage
```

### macOS (DMG)

Requirements: Xcode Command Line Tools, plus the common ones above.

```bash
xcode-select --install
rustup target add aarch64-apple-darwin x86_64-apple-darwin   # only for a cross-architecture build

vp run dist:desktop:dmg          # this machine's architecture
vp run dist:desktop:dmg:arm64    # Apple Silicon
vp run dist:desktop:dmg:x64      # Intel
```

Open the `.dmg` in `release/` and drag the app to Applications. Builds are unsigned unless you pass `--signed` with Apple credentials ([release runbook](./docs/operations/release.md)), so on first launch right-click the app and choose **Open**.

### Windows (NSIS installer)

Requirements, in addition to the common ones:

- Python 3 (used by node-gyp).
- Visual Studio Build Tools with **Desktop development with C++**, including the Windows SDK and the MSVC build tools and Spectre-mitigated libraries for your architecture.
- The matching Rust target.

```powershell
rustup target add x86_64-pc-windows-msvc      # or aarch64-pc-windows-msvc for ARM64

vp run dist:desktop:win          # this machine's architecture
vp run dist:desktop:win:x64
vp run dist:desktop:win:arm64
```

Run the `.exe` installer in `release/`. It is unsigned, so SmartScreen will warn you.

### Run from source instead

To try the fork without packaging it:

```bash
vp run dev
```

Open the pairing URL printed in the `[dev-runner]` output. The bare origin does not authenticate a new browser. See [docs/operations/development.md](./docs/operations/development.md).

### Troubleshooting

- **`vp i` fails with `ENETUNREACH`** on a network without IPv6: run it as `NODE_OPTIONS="--dns-result-order=ipv4first --no-network-family-autoselection" vp i`.
- **The build script lists missing prerequisites.** It checks the tools above before building and prints what is missing and how to install it.
- **`rustc` is too old** (for example Ubuntu's packaged one): remove the distro package and use rustup.

## Documentation

Full docs live in [docs/](./docs).

- [Install and first run](./docs/user/install.md)
- [Custom Provider](./docs/user/providers-custom.md)
- [Permission modes](./docs/user/permission-modes.md)
- [Keyboard shortcuts](./docs/user/keybindings.md)
- [Project settings](./docs/user/project-settings.md)
- [Remote access from a phone or another machine](./docs/user/remote-access.md)
- [Connect other agents over MCP](./docs/user/outside-agents.md)
- Multiple accounts: [Codex](./docs/user/providers-codex.md) · [Claude](./docs/user/providers-claude.md)
- [Run T3 Code as a background service](./docs/user/background-service.md)

Architecture and contributor notes start at [docs/internals/overview.md](./docs/internals/overview.md); read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a PR upstream.
