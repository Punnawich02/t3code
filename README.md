# T3 Code (Fork ที่เพิ่ม Custom Provider)

โปรเจกต์นี้เป็น fork ของ [T3 Code](https://github.com/pingdotgg/t3code) โดย T3 Tools Inc. (`pingdotgg/t3code`) ซึ่งเป็น open source "agent harness control surface" สำหรับควบคุม Codex, Claude Code, Cursor, Grok Build, OpenCode และ Google Antigravity ผ่านแอป web, desktop และ mobile

Fork นี้ใช้ server, web, desktop และ mobile ของต้นฉบับทั้งหมด โดยต่อยอดจาก upstream commit `1451e7cb2` เครดิตของโปรเจกต์ต้นทางเป็นของทีมผู้พัฒนา T3 Code และยังคงใช้สัญญาอนุญาต MIT ตามไฟล์ [LICENSE](./LICENSE)

สิ่งที่ fork นี้เพิ่มเข้ามาคือความสามารถในการเชื่อมต่อกับ inference server ที่ไม่ใช่ provider ที่มีมาให้ในตัว

## สิ่งที่ fork นี้เพิ่ม

- **Custom Provider** เชื่อมต่อ endpoint ที่เข้ากันได้กับ OpenAI (Ollama, LM Studio, vLLM, gateway ที่โฮสต์ไว้ ฯลฯ) ได้จาก **Settings → Providers → Add provider → Custom Provider** กรอก Base URL และ API key (ไม่บังคับ) ระบบจะค้นหา model จาก `/v1/models` ให้เอง ภายในใช้ Codex ที่ T3 Code จัดการให้ รันกับ endpoint นั้น และถ้ายังไม่มี Codex ระบบจะดาวน์โหลดให้เอง ดู [docs/user/providers-custom.md](./docs/user/providers-custom.md)
- **เลือกวิธีเชื่อมต่อใน Add provider** หน้าต่างจะถามก่อนว่าจะเชื่อมต่อแบบไหน: **Sign in** (ใช้ CLI, แอป หรือบัญชีที่มีอยู่แล้ว) หรือ **API key** (Claude API, OpenAI API, Gemini API หรือ endpoint ที่เข้ากันได้กับ OpenAI) instance ของ Claude ใช้ Anthropic API key ได้โดยมี config directory แยกของตัวเอง จึงใช้ Claude ที่ sign in ไว้กับ Claude API ควบคู่กันได้ ดู [docs/user/install.md](./docs/user/install.md#providers) และ [docs/user/providers-claude.md](./docs/user/providers-claude.md)

ส่วนอื่นทำงานเหมือนต้นฉบับ ดูสารบัญเอกสารของ upstream ได้ที่หัวข้อ [เอกสาร](#เอกสาร)

## การติดตั้ง

Fork นี้ไม่ได้ปล่อย release สำเร็จรูป ต้อง build แอป desktop เอง (ดูหัวข้อถัดไป) **ห้ามใช้** วิธีติดตั้งใน README ของ upstream อย่าง `curl ... t3.codes/install.sh`, `winget`, `scoop`, `brew` หรือ AUR เพราะจะได้ build ของต้นฉบับ ซึ่งไม่มีฟีเจอร์ข้างบน

ต้องมีอย่างน้อยหนึ่ง provider ไว้คุยด้วย สำหรับ Custom Provider คือมี endpoint ที่รันอยู่ เช่น Ollama ที่ `http://localhost:11434/v1` และควรตั้ง context window อย่างน้อย 32k tokens

## Build แอป desktop

### สิ่งที่ต้องมี (ทุก OS)

| สิ่งที่ต้องมี                          | หมายเหตุ                                                                                                                           |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Git                                    | สำหรับ clone repository                                                                                                            |
| Node.js 24 (`^24.13.1`)                | กำหนดไว้ใน `engines` ของ `package.json` และ `vp` ด้านล่างสามารถจัดหาให้ได้                                                         |
| `vp` (Vite+)                           | task runner และตัวครอบ package manager ระบบจะเลือก `pnpm@11` ให้เองจาก `packageManager`                                            |
| Rust 1.85 ขึ้นไป (ผ่าน rustup)         | ใช้ build resource monitor ตัว native ให้ติดตั้งผ่าน [rustup](https://rustup.rs) ไม่ใช่แพ็กเกจของ distro เพราะต้องใช้ edition 2024 |
| พื้นที่ว่างประมาณ 5 GB และอินเทอร์เน็ต | dependencies มีขนาดใหญ่ และ electron-builder ต้องดาวน์โหลด Electron กับเครื่องมือแพ็กเกจ                                           |

ติดตั้ง `vp`:

```bash
# macOS / Linux
curl -fsSL https://vite.plus | bash
```

```powershell
# Windows (PowerShell)
irm https://vite.plus/ps1 | iex
```

ดึง source และติดตั้ง dependencies (เหมือนกันทุก OS):

```bash
git clone https://github.com/Punnawich02/t3code.git
cd t3code
vp i
```

แต่ละ OS ต้อง build installer บนเครื่อง OS นั้นเอง เครื่อง Linux build แอป macOS หรือ Windows ไม่ได้ และกลับกัน ผลลัพธ์อยู่ในโฟลเดอร์ `release/`

### Linux (AppImage และ `.deb`)

ต้อง build บน Linux เพราะ browser-secret helper ลิงก์กับ libsecret ของเครื่อง

```bash
# Ubuntu / Debian
sudo apt-get update
sudo apt-get install build-essential libsecret-1-dev pkg-config imagemagick
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh   # จากนั้นเปิด shell ใหม่

# Fedora
sudo dnf install gcc gcc-c++ make libsecret-devel pkgconf-pkg-config ImageMagick

# Arch
sudo pacman -S base-devel libsecret pkgconf imagemagick
# แล้วติดตั้ง Rust ด้วย rustup เหมือนข้างบน
```

Build และติดตั้ง:

```bash
vp run dist:desktop:linux
```

คำสั่งนี้สร้าง AppImage และ `.deb` ใน `release/`

```bash
# Debian / Ubuntu
sudo apt install ./release/T3-Code-*.deb

# ทุก distro
chmod +x release/T3-Code-*.AppImage && ./release/T3-Code-*.AppImage
```

### macOS (DMG)

ต้องมี Xcode Command Line Tools นอกเหนือจากที่ต้องมีทุก OS

```bash
xcode-select --install
rustup target add aarch64-apple-darwin x86_64-apple-darwin   # เฉพาะเมื่อ build ข้ามสถาปัตยกรรม

vp run dist:desktop:dmg          # สถาปัตยกรรมของเครื่องนี้
vp run dist:desktop:dmg:arm64    # Apple Silicon
vp run dist:desktop:dmg:x64      # Intel
```

เปิดไฟล์ `.dmg` ใน `release/` แล้วลากแอปไปที่ Applications ถ้าไม่ได้ใส่ `--signed` พร้อม credentials ของ Apple ([release runbook](./docs/operations/release.md)) แอปจะไม่ถูก sign ดังนั้นเปิดครั้งแรกให้คลิกขวาที่แอปแล้วเลือก **Open**

### Windows (ตัวติดตั้ง NSIS)

สิ่งที่ต้องมีเพิ่มจากที่ต้องมีทุก OS:

- Python 3 (node-gyp ใช้)
- Visual Studio Build Tools พร้อม **Desktop development with C++** รวม Windows SDK, MSVC build tools และ Spectre-mitigated libraries ของสถาปัตยกรรมที่ใช้
- Rust target ที่ตรงกัน

```powershell
rustup target add x86_64-pc-windows-msvc      # หรือ aarch64-pc-windows-msvc สำหรับ ARM64

vp run dist:desktop:win          # สถาปัตยกรรมของเครื่องนี้
vp run dist:desktop:win:x64
vp run dist:desktop:win:arm64
```

รันตัวติดตั้ง `.exe` ใน `release/` ตัวติดตั้งไม่ได้ถูก sign จึงมีคำเตือนจาก SmartScreen

### รันจาก source โดยไม่ต้องแพ็กเกจ

ถ้าแค่อยากลอง fork นี้:

```bash
vp run dev
```

เปิด pairing URL ที่แสดงในบรรทัด `[dev-runner]` การเปิด origin เปล่า ๆ จะไม่ยืนยันตัวตนให้ browser ใหม่ ดู [docs/operations/development.md](./docs/operations/development.md)

### แก้ปัญหา

- **`vp i` ล้มเหลวด้วย `ENETUNREACH`** บนเครือข่ายที่ไม่มี IPv6: รันเป็น `NODE_OPTIONS="--dns-result-order=ipv4first --no-network-family-autoselection" vp i`
- **สคริปต์ build แจ้งว่าขาดเครื่องมือ** สคริปต์ตรวจเครื่องมือข้างบนก่อน build และจะบอกว่าขาดอะไรกับวิธีติดตั้ง
- **`rustc` เก่าเกินไป** (เช่นแพ็กเกจของ Ubuntu): ถอนแพ็กเกจของ distro แล้วใช้ rustup

## เอกสาร

เอกสารทั้งหมดอยู่ใน [docs/](./docs)

- [ติดตั้งและเริ่มใช้งานครั้งแรก](./docs/user/install.md)
- [Custom Provider](./docs/user/providers-custom.md)
- [Permission modes](./docs/user/permission-modes.md)
- [Keyboard shortcuts](./docs/user/keybindings.md)
- [Project settings](./docs/user/project-settings.md)
- [เข้าถึงจากมือถือหรือเครื่องอื่น](./docs/user/remote-access.md)
- [เชื่อมต่อ agent อื่นผ่าน MCP](./docs/user/outside-agents.md)
- หลายบัญชี: [Codex](./docs/user/providers-codex.md) · [Claude](./docs/user/providers-claude.md)
- [รัน T3 Code เป็น background service](./docs/user/background-service.md)

สถาปัตยกรรมและบันทึกสำหรับผู้พัฒนาเริ่มที่ [docs/internals/overview.md](./docs/internals/overview.md) และอ่าน [CONTRIBUTING.md](./CONTRIBUTING.md) ก่อนเปิด PR ไปที่ upstream
