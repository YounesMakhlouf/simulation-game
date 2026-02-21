# Copilot Instructions for Clash of Titans

## Project Overview
Turn-based historical grand strategy game with AI-powered characters. Modular monolith architecture:
- **philoagents-api/** – Python backend (FastAPI, LangGraph agents, MongoDB)
- **philoagents-ui/** – JavaScript frontend (Phaser.js game engine)
- **scenarios/** – JSON configuration packs defining game settings, characters, and narratives

## Architecture Patterns

### Domain-Driven Design (philoagents-api)
```
src/philoagents/
├── domain/        # Core entities: Character, Action, GameState, prompts
├── application/   # Use cases: conversation_service, game_loop_service, rag
├── infrastructure/# External interfaces: FastAPI routes, MongoDB, Opik
```

### LangGraph Agent Workflows
Two main agent graphs in `application/`:
1. **conversation_service/workflow/** – Character dialogue with RAG retrieval:
   - `graph.py` defines node flow: conversation → RAG retrieval → context summarization
   - Uses `tools_condition` for conditional RAG tool invocation
2. **game_loop_service/workflow/** – Turn resolution:
   - `create_action_graph()` – AI delegate decision-making
   - `create_judge_graph()` – Round resolution with hidden "Undergame" narrative

### Scenario Configuration
Scenarios are JSON packs in `src/philoagents/scenarios/`:
- `manifest.json` – Metadata, undergame_plot (secret AI Judge instructions)
- `characters.json` – Character definitions with resources, goals, perspectives
- `initial_state.json` – Starting game state
- `rag_sources.json` – URLs for long-term memory population

## Key Development Commands

```bash
# From project root:
make infrastructure-up          # Start Docker (MongoDB:27017, API:8000, UI:8080)
make create-long-term-memory    # Populate RAG vector store (required before playing)
make call-agent                 # Test agent directly, bypassing UI
make evaluate-agent             # Run Opik evaluations
make delete-long-term-memory    # Clear MongoDB RAG data
```

## Code Conventions

### Python (philoagents-api)
- **Pydantic models** for all domain entities and API payloads
- **Settings via pydantic-settings**: See [config.py](../philoagents-api/src/philoagents/config.py) for all env vars
- **Prompts**: Use `Prompt` wrapper class in [domain/prompts.py](../philoagents-api/src/philoagents/domain/prompts.py) for Opik versioning
- **Async patterns**: All LangGraph nodes and API handlers are async
- **LLM calls**: Use `langchain-groq` chains, models configured in `settings.GROQ_*`

### JavaScript (philoagents-ui)
- **Phaser.js scenes** in `src/scenes/` – each modal/screen is a separate scene
- **ApiService.js** handles all backend communication
- **CharacterConfig.js** maps character IDs to sprite/asset paths

### Adding a New Character
1. Add character to scenario's `characters.json` with id, name, perspective, style, goals, resources
2. Add entry to `rag_sources.json` with source URLs
3. Place sprite assets in `philoagents-ui/public/assets/characters/{character_id}/`
4. Register in `philoagents-ui/src/configs/CharacterConfig.js`
5. Run `make create-long-term-memory` to rebuild RAG index

### Creating a New Scenario
1. Create folder in `src/philoagents/scenarios/{scenario_id}/`
2. Provide: `manifest.json`, `characters.json`, `initial_state.json`, `rag_sources.json`
3. Update `settings.SCENARIO_PATH` in `.env` or `config.py`

## External Dependencies
- **Groq API** (`GROQ_API_KEY`) – Powers all LLM inference
- **OpenAI API** (`OPENAI_API_KEY`) – Required for evaluation only
- **Opik/Comet** (`COMET_API_KEY`) – LLM tracing and evaluation dashboard
- **MongoDB** – Vector store (RAG), conversation checkpoints, game state

## Testing & Debugging
- API docs at `http://localhost:8000/docs`
- Opik dashboard for prompt traces and evaluations
- `tools/call_agent.py` – Direct agent invocation for debugging
- Evaluation dataset at `data/evaluation_dataset.json`
