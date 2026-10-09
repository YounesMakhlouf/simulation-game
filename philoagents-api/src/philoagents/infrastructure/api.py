import inspect
import json
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import (
    Depends,
    FastAPI,
    HTTPException,
    Request,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from loguru import logger
from opik.integrations.langchain import OpikTracer
from pydantic import BaseModel, Field
from pymongo.errors import PyMongoError

from philoagents.application.conversation_service.generate_response import (
    get_response,
    get_streaming_response,
)
from philoagents.application.conversation_service.negotiation import (
    summarize_negotiation,
)
from philoagents.application.conversation_service.reset_conversation import (
    reset_conversation_state,
)
from philoagents.application.game_loop_service.api import router as game_loop_router
from philoagents.application.game_loop_service.service import GameLoopService
from philoagents.config import settings
from philoagents.infrastructure.dependencies import (
    get_game_service,
)

from .opik_utils import configure

configure()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handles startup and shutdown events for the API."""
    # Build singletons at boot so a bad scenario/Mongo fails fast, going
    # through dependency_overrides so tests can stub the provider.
    result = app.dependency_overrides.get(get_game_service, get_game_service)()
    if inspect.isawaitable(result):
        await result
    yield
    # Shutdown code goes here
    opik_tracer = OpikTracer()
    opik_tracer.flush()


app = FastAPI(lifespan=lifespan)


@app.exception_handler(PyMongoError)
async def storage_unavailable(request: Request, error: PyMongoError):
    logger.error(f"Game storage failed: {error}")
    return JSONResponse(
        status_code=503,
        content={"detail": "Game storage is unavailable. Please try again."},
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatMessage(BaseModel):
    """
    Defines the payload for initiating a conversation turn.
    """

    message: str = Field(description="The content of the message being sent.")
    sender_id: str = Field(description="The ID of the character sending the message.")
    receiver_id: str = Field(
        description="The ID of the character receiving the message."
    )


@app.post("/chat")
async def chat(
    chat_message: ChatMessage,
    service: Annotated[GameLoopService, Depends(get_game_service)],
):
    try:
        async with service.negotiation_turn(
            chat_message.sender_id, chat_message.receiver_id
        ) as state:
            response, _ = await get_response(
                messages=chat_message.message,
                sender_id=chat_message.sender_id,
                receiver_character=state.characters[chat_message.receiver_id],
                game_id=state.game_id,
                crisis_update=f"Round {state.round_number}: {state.crisis_update}",
                negotiation_summaries=state.negotiation_summaries.get(
                    chat_message.receiver_id, {}
                ),
            )
            await summarize_negotiation(
                state,
                chat_message.sender_id,
                chat_message.receiver_id,
                chat_message.message,
                response,
            )
        return {"response": response}

    except PyMongoError:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Chat request failed.")
        opik_tracer = OpikTracer()
        opik_tracer.flush()

        raise HTTPException(
            status_code=500,
            detail="Conversation could not be completed or saved. Please try again.",
        ) from e


@app.websocket("/ws/chat")
async def websocket_chat(
    websocket: WebSocket,
    service: Annotated[GameLoopService, Depends(get_game_service)],
):
    await websocket.accept()

    try:
        while True:
            try:
                raw = await websocket.receive_text()
            except WebSocketDisconnect:
                raise
            except (KeyError, RuntimeError):
                # A non-text frame (e.g. binary) makes receive_text() raise.
                # Reject it but keep the connection usable.
                await websocket.send_json(
                    {"error": "Only text (JSON) messages are supported."}
                )
                continue

            if len(raw.encode("utf-8")) > settings.MAX_WS_MESSAGE_BYTES:
                await websocket.send_json(
                    {
                        "error": (
                            "Message too large. Limit is "
                            f"{settings.MAX_WS_MESSAGE_BYTES} bytes."
                        )
                    }
                )
                continue

            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({"error": "Message must be valid JSON."})
                continue

            if not isinstance(data, dict) or not all(
                isinstance(data.get(field), str)
                for field in ("message", "sender_id", "receiver_id")
            ):
                await websocket.send_json(
                    {
                        "error": (
                            "Invalid message format. Required string fields: "
                            "'message', 'sender_id', 'receiver_id'."
                        )
                    }
                )
                continue

            if len(data["message"]) > settings.MAX_CHAT_MESSAGE_CHARS:
                await websocket.send_json(
                    {
                        "error": (
                            "Chat message too long. Limit is "
                            f"{settings.MAX_CHAT_MESSAGE_CHARS} characters."
                        )
                    }
                )
                continue

            try:
                async with service.negotiation_turn(
                    data["sender_id"], data["receiver_id"]
                ) as state:
                    response_stream = get_streaming_response(
                        messages=data["message"],
                        sender_id=data["sender_id"],
                        receiver_character=state.characters[data["receiver_id"]],
                        game_id=state.game_id,
                        crisis_update=f"Round {state.round_number}: {state.crisis_update}",
                        negotiation_summaries=state.negotiation_summaries.get(
                            data["receiver_id"], {}
                        ),
                    )
                    await websocket.send_json({"streaming": True})

                    full_response = ""
                    async for chunk in response_stream:
                        full_response += chunk
                        await websocket.send_json({"chunk": chunk})
                    await summarize_negotiation(
                        state,
                        data["sender_id"],
                        data["receiver_id"],
                        data["message"],
                        full_response,
                    )

                await websocket.send_json(
                    {"response": full_response, "streaming": False}
                )

            except Exception as e:
                logger.exception("Streaming chat request failed.")
                opik_tracer = OpikTracer()
                opik_tracer.flush()

                await websocket.send_json(
                    {
                        "error": (
                            "Game storage is unavailable. Please try again."
                            if isinstance(e, PyMongoError)
                            else "Conversation could not be completed or saved. Please try again."
                        )
                    }
                )

    except WebSocketDisconnect:
        pass


@app.post("/reset-memory")
async def reset_conversation():
    """Resets the conversation state. It deletes the two collections needed for keeping LangGraph state in MongoDB.

    Raises:
        HTTPException: If there is an error resetting the conversation state.
    Returns:
        dict: A dictionary containing the result of the reset operation.
    """
    try:
        result = await reset_conversation_state()
        return result
    except Exception as e:
        logger.exception("Conversation reset failed.")
        raise HTTPException(status_code=500, detail=str(e))


app.include_router(game_loop_router)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
