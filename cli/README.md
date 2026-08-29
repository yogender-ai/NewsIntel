# cfai — Cloudflare Workers AI in your terminal

```bash
cfai "explain HNSW indexes in one sentence"     # one-shot
cfai                                             # interactive session
cat main.py | cfai "find the bug"                # pipe stdin as context
cfai -m coder "write a bash retry wrapper"       # pick a model
cfai --models                                    # list models
```

Replies stream as they generate. Ctrl-C stops a reply without leaving the session.

## Install

```bash
sudo ln -sf "$PWD/cli/cfai" /usr/local/bin/cfai     # or ~/.local/bin
cfai --login                                         # stores creds, chmod 600
```

`--login` writes `~/.config/cfai/config.json`. You can skip it by exporting
`CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`; inside a News-Intel checkout
it also falls back to `backend/.env`, so it works there with no setup.

The token needs only **Workers AI: Read**.

## Models

| Alias | Model | Good for |
| --- | --- | --- |
| `gpt-oss` | `@cf/openai/gpt-oss-120b` | default; reasoning, analysis |
| `gpt-oss-20b` | `@cf/openai/gpt-oss-20b` | same family, faster |
| `llama` | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | fast general chat |
| `coder` | `@cf/qwen/qwen2.5-coder-32b-instruct` | code |
| `mistral` | `@cf/mistralai/mistral-small-3.1-24b-instruct` | concise answers |

## Session commands

`/reset` clears context · `/model <name>` switches mid-conversation · `/exit` quits

## A note on token budgets

The gpt-oss models generate hidden reasoning tokens before any visible output, and
those count against `max_tokens`. Ask for 30 tokens and you get an empty reply with
`finish_reason: length` rather than an error. Both this CLI and the `/api/chat`
endpoint floor the budget at 400 for those models.

Depends only on the Python 3 standard library.
