# Custom Provider

Connect any local or remote OpenAI-compatible inference server to T3 Code.

## Adding a custom provider

1. Go to **Settings → Providers**.
2. Click **Add provider** and choose **Custom Provider**.
3. Set the **Base URL**, including the `/v1` prefix (for example, `http://localhost:11434/v1` for Ollama).
4. If your endpoint requires authentication, enter your **API key**. Leave it blank for local servers that do not require one.

> **Note:** `localhost` refers to the machine running T3 Code's server, not your browser or phone.

## Endpoint requirements

- **Responses API:** The endpoint must support the OpenAI Responses API (`/v1/responses`).
- **Models:** T3 Code discovers available models automatically from `/v1/models`. You can also configure additional model IDs manually in provider settings.
- **Context window:** T3 Code works best with large context windows. For Ollama or other local runners, configure `num_ctx` to at least 32,768 (32k).
- **Model sizing:** Smaller local models handle targeted, well-specified edits best. For open-ended architectural changes, prefer larger models or cloud providers.
