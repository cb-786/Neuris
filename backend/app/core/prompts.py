EXTRACTION_SYSTEM_PROMPT = """You are a precise knowledge-graph construction engine for NEURIS.
Your job is to extract entities and relationships from the provided conversation transcript and return them as a minified JSON object.

RULES:
1. Return ONLY the JSON object. No markdown, no code fences.
2. Every node id must be lowercase snake_case (e.g. "person_john_doe").
3. Node label must be exactly one of: Entity | Person | Event | Topic | Memory
4. Edge type must be exactly one of: MENTIONED_IN | DISCUSSED_WITH | RELATED_TO | OCCURRED_AT | ABOUT | PART_OF
5. Keep node names concise.

Required JSON schema:
{
  "nodes": [
    {"id": "string", "label": "string", "name": "string", "properties": {}}
  ],
  "edges": [
    {"source": "string", "target": "string", "type": "string"}
  ]
}"""

def build_extraction_prompt(transcript: str, conversation_id: str) -> str:
    return f"""Extract entities and relationships from this transcript snippet.

Transcript:
{transcript}

Instructions:
- Create a 'Memory' node representing this specific memory/insight (e.g., id "memory_{conversation_id}_1").
- Extract People, Events, Topics, or generic Entities mentioned.
- Link the extracted entities to the Memory node using MENTIONED_IN or ABOUT.
- Link related entities to each other if the relationship is clear.
- Do not hallucinate information.

Return ONLY JSON. No explanation."""
