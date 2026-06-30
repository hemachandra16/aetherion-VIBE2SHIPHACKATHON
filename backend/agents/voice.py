import asyncio
import json
import logging
import os
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from .gemini_client import get_client
from google.genai import types
from .pipeline import run_agent_pipeline

logger = logging.getLogger("aetherion.voice")
router = APIRouter(prefix="/api/voice")

# Use a model that supports Live API
VOICE_MODEL = "gemini-2.0-flash" 

@router.websocket("/stream")
async def voice_stream(websocket: WebSocket, session_id: str = "default"):
    await websocket.accept()
    
    # Live API using the standard client
    client = get_client()
    
    config = types.LiveConnectConfig(
        system_instruction=types.Content(parts=[types.Part.from_text(
            text="You are Aetherion, an AI crisis planner. "
                 "Talk to the user to understand their crisis. "
                 "When you have enough info, use the generate_plan function to create a recovery plan."
        )]),
        tools=[
            types.Tool(
                function_declarations=[
                    types.FunctionDeclaration(
                        name="generate_plan",
                        description="Run the triage and planning pipeline for a user's crisis.",
                        parameters=types.Schema(
                            type=types.Type.OBJECT,
                            properties={
                                "issue_description": types.Schema(
                                    type=types.Type.STRING,
                                    description="The detailed description of the crisis or disruption."
                                )
                            },
                            required=["issue_description"]
                        )
                    )
                ]
            )
        ]
    )

    try:
        # Use the async client for live API
        async with client.aio.live.connect(model=VOICE_MODEL, config=config) as session:
            
            # Task to receive audio from Gemini and send to client
            async def receive_from_gemini():
                try:
                    async for response in session.receive():
                        server_content = response.server_content
                        if server_content and server_content.model_turn:
                            for part in server_content.model_turn.parts:
                                if part.inline_data:
                                    # Send audio data back to frontend
                                    await websocket.send_bytes(part.inline_data.data)
                                elif part.function_call:
                                    fc = part.function_call
                                    if fc.name == "generate_plan":
                                        crisis_desc = fc.args.get("issue_description", "")
                                        
                                        # Run the pipeline in background
                                        async def background_pipeline():
                                            try:
                                                res = await run_agent_pipeline(crisis_desc, session_id, [])
                                                # Send back via websocket
                                                await websocket.send_text(json.dumps(res))
                                            except Exception as e:
                                                logger.error(f"[voice] Pipeline error: {e}")
                                        
                                        asyncio.create_task(background_pipeline())

                                        # Respond to Gemini so it knows the tool was triggered
                                        tool_resp = types.LiveClientContent(
                                            tool_response=types.ToolResponse(
                                                function_responses=[
                                                    types.FunctionResponse(
                                                        name=fc.name,
                                                        id=fc.id,
                                                        response={"result": "Pipeline triggered successfully in the backend. Tell the user the plan is ready."}
                                                    )
                                                ]
                                            )
                                        )
                                        await session.send(input=tool_resp)
                except Exception as e:
                    logger.error(f"[voice] Error receiving from Gemini: {e}")
                    
            # Task to receive audio from client and send to Gemini
            async def receive_from_client():
                try:
                    while True:
                        # Receive binary audio data from the frontend
                        data = await websocket.receive_bytes()
                        # Send to Gemini with matching 24kHz rate
                        await session.send(input={"data": data, "mime_type": "audio/pcm;rate=24000"}, end_of_turn=False)
                except WebSocketDisconnect:
                    logger.info("[voice] Client disconnected")
                except Exception as e:
                    logger.error(f"[voice] Error receiving from client: {e}")

            # Run both tasks concurrently
            await asyncio.gather(
                receive_from_gemini(),
                receive_from_client()
            )
            
    except Exception as e:
        logger.error(f"[voice] Live API connection failed: {e}")
        try:
            await websocket.close(code=1011)
        except:
            pass
