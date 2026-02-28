# LLM Shell API

AI-assisted SSH client backend.

## Installation

```bash
pip install -e ".[dev]"
```

## Running

```bash
uvicorn llm_shell.main:app --reload
```

## Testing

```bash
pytest tests/ -v
```
