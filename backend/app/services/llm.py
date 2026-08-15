import logging
import json
from google import genai
from google.genai import types
from app.core.config import settings

logger = logging.getLogger(__name__)

class LLMService:
    def __init__(self):
        if not settings.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY is not set.")
        self._client = genai.Client(api_key=settings.GEMINI_API_KEY)
        self._model = settings.LLM_MODEL
        logger.info(f"LLMService ready | model={self._model}")

    async def complete(self, prompt: str, system: str | None = None, json_mode: bool = False) -> str:
        logger.debug(f"LLM ▶ model={self._model} prompt={prompt[:120]}...")
        
        # Build generation config if needed
        generation_config = {}
        if json_mode:
            generation_config["response_mime_type"] = "application/json"
            generation_config["temperature"] = 0.1
            
        kwargs = {
            "model": self._model,
            "input": prompt
        }
        if system:
            kwargs["system_instruction"] = system
        if generation_config:
            kwargs["generation_config"] = generation_config
            
        import asyncio
        loop = asyncio.get_event_loop()
        
        def _call_api():
            return self._client.interactions.create(**kwargs)
            
        interaction = await loop.run_in_executor(None, _call_api)
        return interaction.output_text

    async def generate_embedding(self, text: str) -> list[float]:
        logger.debug(f"LLM Embed ▶ text={text[:50]}...")
        response = await self._client.aio.models.embed_content(
            model='gemini-embedding-2',
            contents=text,
            config=types.EmbedContentConfig(output_dimensionality=768)
        )
        return response.embeddings[0].values
        
    async def synthesize_graphrag_context(self, query: str, graph_context: list[dict]) -> dict:
        context_str = json.dumps(graph_context, indent=2)
        system_instruction = (
            "You are NEURIS, an expert personal memory assistant. "
            "Your job is to answer the user's query based ONLY on the provided memory graph context.\n\n"
            "Rules:\n"
            "1. Analyze the user's query against the provided graph context.\n"
            "2. Synthesize a helpful, conversational response drawing on the memories and entities.\n"
            "3. Return ONLY a valid JSON object with the keys: 'response' (the actual answer to the user), "
            "and 'entities_referenced' (a list of entity names you used from the context).\n"
            "Do not use markdown formatting like ```json ... ```. Output raw JSON only."
        )
        user_prompt = f"User Query: {query}\n\nRetrieved Graph Context:\n{context_str}"
        
        try:
            raw_response = await self.complete(prompt=user_prompt, system=system_instruction, json_mode=True)
            clean_json = raw_response.strip().removeprefix("```json").removesuffix("```").strip()
            return json.loads(clean_json)
        except Exception as e:
            logger.error(f"Failed to synthesize graph context: {e}")
            return {
                "response": "I'm having trouble accessing my memories right now.",
                "entities_referenced": []
            }

llm_service = LLMService()
