import json
import logging
import re
from typing import Tuple, List

from app.services.llm import llm_service
from app.services.neo4j_service import neo4j_service
from app.services.context_builder import context_builder
from app.core.prompts import EXTRACTION_SYSTEM_PROMPT, build_extraction_prompt
from app.models.graph_models import GraphResult, Node, Edge

logger = logging.getLogger(__name__)

class GraphRAGService:
    async def extract_and_store(self, transcript: str, conversation_id: str) -> dict:
        """Extracts entities from transcript and writes them to Neo4j."""
        prompt = build_extraction_prompt(transcript, conversation_id)
        raw = await llm_service.complete(prompt, system=EXTRACTION_SYSTEM_PROMPT, json_mode=True)
        nodes, edges = self._parse_llm_response(raw)
        
        result = GraphResult(nodes=nodes, edges=edges, raw_llm_response=raw)
        
        # Hydrate nodes with embeddings immediately before saving
        for node in result.nodes:
            # We skip embedding the Memory node itself to save tokens, we only embed Entities/People/Topics
            if node.label != "Memory":
                node.properties["embedding"] = await llm_service.generate_embedding(node.name)
        
        summary = await neo4j_service.write_graph_result(result)
        return summary

    async def retrieve_and_synthesize(self, query: str) -> dict:
        """Full GraphRAG retrieval pipeline."""
        # 1. Embed query
        query_vector = await llm_service.generate_embedding(query)
        
        # 2. Vector search + 2-hop traversal in Neo4j
        raw_graph_results = await neo4j_service.search_semantic_with_context(query_vector, top_k=5)
        
        if not raw_graph_results:
            return {
                "response": "I couldn't find any relevant memories regarding that.",
                "entities": [],
                "context_used": []
            }
            
        # 3. Build structured context
        structured_context = context_builder.build_grounded_context(raw_graph_results)
        
        # 4. LLM Synthesis
        synthesis = await llm_service.synthesize_graphrag_context(query, structured_context)
        
        return {
            "response": synthesis.get("response", ""),
            "entities": synthesis.get("entities_referenced", []),
            "context_used": structured_context
        }

    def _parse_llm_response(self, raw: str) -> Tuple[List[Node], List[Edge]]:
        cleaned = re.sub(r"```(?:json)?|```", "", raw).strip()
        try:
            data = json.loads(cleaned)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON: {e} \nRaw: {raw}")
            return [], []

        nodes = [Node(**n) for n in data.get("nodes", [])]
        edges = [Edge(**e) for e in data.get("edges", [])]
        return nodes, edges

graphrag_service = GraphRAGService()
