"""
AWS Bedrock agent provider.
Uses Claude (via Bedrock) with RAG context and per-clone persona prompts.
"""
import asyncio
import boto3

from ....core.config import get_settings
from ....services.interfaces.agent import AgentProvider, AgentContext, AgentResponse


class AWSBedrockAgent:
    def __init__(self):
        settings = get_settings()
        self._settings = settings
        self._client = boto3.client(
            "bedrock-runtime",
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None,
        )

    async def chat(self, user_message: str, context: AgentContext) -> AgentResponse:
        loop = asyncio.get_event_loop()
        text = await loop.run_in_executor(None, self._chat_sync, user_message, context)
        return AgentResponse(text=text, session_id=context.session_id)

    async def chat_stream(self, user_message: str, context: AgentContext):
        """Async generator yielding text tokens from Bedrock converse_stream.

        Runs the synchronous boto3 event stream in a thread and bridges each
        token back to the asyncio loop via a Queue + run_coroutine_threadsafe.
        """
        loop = asyncio.get_running_loop()
        queue: asyncio.Queue = asyncio.Queue()

        def _stream_sync():
            system_prompt = self._build_system_prompt(context)
            messages = []
            for msg in context.history[-10:]:
                messages.append({
                    "role": msg["role"],
                    "content": [{"text": msg["content"]}],
                })
            messages.append({"role": "user", "content": [{"text": user_message}]})

            response = self._client.converse_stream(
                modelId=self._settings.BEDROCK_MODEL_ID,
                system=[{"text": system_prompt}],
                messages=messages,
                inferenceConfig={"maxTokens": 1024, "temperature": 0.7},
            )
            for event in response["stream"]:
                if "contentBlockDelta" in event:
                    token = event["contentBlockDelta"]["delta"].get("text", "")
                    if token:
                        asyncio.run_coroutine_threadsafe(queue.put(token), loop)
            asyncio.run_coroutine_threadsafe(queue.put(None), loop)  # sentinel

        loop.run_in_executor(None, _stream_sync)
        while True:
            chunk = await queue.get()
            if chunk is None:
                break
            yield chunk

    def _chat_sync(self, user_message: str, context: AgentContext) -> str:
        system_prompt = self._build_system_prompt(context)

        # Build message history (Converse API format — works with Claude + Nova + Titan)
        messages = []
        for msg in context.history[-10:]:
            messages.append({
                "role": msg["role"],
                "content": [{"text": msg["content"]}],
            })
        messages.append({"role": "user", "content": [{"text": user_message}]})

        response = self._client.converse(
            modelId=self._settings.BEDROCK_MODEL_ID,
            system=[{"text": system_prompt}],
            messages=messages,
            inferenceConfig={"maxTokens": 1024, "temperature": 0.7},
        )

        return response["output"]["message"]["content"][0]["text"]

    def _build_system_prompt(self, context: AgentContext) -> str:
        knowledge_block = ""
        if context.knowledge_snippets:
            snippets = "\n\n".join(
                f"- {s}" for s in context.knowledge_snippets
            )
            knowledge_block = f"""
## Relevant knowledge from your life and beliefs:
{snippets}

Draw on the above naturally in your response — do not quote it verbatim.
"""

        domain_instruction = {
            "family": (
                "The person speaking to you is a family member or child seeking "
                "parental guidance, emotional support, or life advice. "
                "Be warm, nurturing, and draw on personal values and family experiences."
            ),
            "professional": (
                "The person speaking to you is a colleague or team member seeking "
                "professional guidance, strategic direction, or career advice. "
                "Be clear, decisive, and draw on your professional experience and leadership values."
            ),
            "general": (
                "The person speaking to you is seeking advice or conversation. "
                "Be authentic and responsive to their needs."
            ),
        }.get(context.domain, "Be authentic and helpful.")

        return f"""{context.persona_prompt}

## Interaction context:
{domain_instruction}
{knowledge_block}
## Important:
- Speak in first person, naturally, as yourself.
- Keep responses conversational and concise (2-4 sentences for voice).
- Never mention that you are an AI or a digital clone.
- Stay true to your values and beliefs in every response.
"""
