import logging
import json
from google import genai
from google.genai import types
from app.core.config import settings

logger = logging.getLogger(__name__)

class LLMService:
    def __init__(self):
        # We use Vertex AI to consume GCP credits instead of standard GEMINI_API_KEY.
        # It automatically picks up the GOOGLE_APPLICATION_CREDENTIALS service account.
        try:
            self._client = genai.Client(
                vertexai=True, 
                project=settings.GCP_PROJECT_ID, 
                location="us-central1"
            )
        except Exception as e:
            logger.warning(f"Could not initialize Vertex AI client: {e}")
            self._client = None
            
        self._model = settings.LLM_MODEL
        logger.info(f"LLMService ready | model={self._model} (Vertex AI)")

    async def complete(self, prompt: str, system: str | None = None, json_mode: bool = False) -> str:
        if not self._client:
            raise ValueError("Vertex AI client is not configured. Check your GCP service account.")
            
        logger.debug(f"LLM ▶ model={self._model} prompt={prompt[:120]}...")
        
        config = types.GenerateContentConfig(
            temperature=0.1 if json_mode else 0.7,
            response_mime_type="application/json" if json_mode else "text/plain",
            system_instruction=system if system else None
        )
        
        models_to_try = [self._model, "gemini-2.5-flash", "gemini-2.5-pro"]
        seen = set()
        models_to_try = [m for m in models_to_try if not (m in seen or seen.add(m))]
        
        last_error = None
        for model_name in models_to_try:
            try:
                response = await self._client.aio.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=config
                )
                return response.text
            except Exception as e:
                logger.warning(f"Model {model_name} failed in complete(): {e}. Trying fallback...")
                last_error = e
                
        raise last_error

    async def generate_embedding(self, text: str) -> list[float]:
        if not self._client:
            raise ValueError("Vertex AI client is not configured. Check your GCP service account.")
            
        logger.debug(f"LLM Embed ▶ text={text[:50]}...")
        response = await self._client.aio.models.embed_content(
            model=settings.EMBEDDING_MODEL,
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
