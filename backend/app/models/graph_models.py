from pydantic import BaseModel, field_validator
from typing import Any, List

class Node(BaseModel):
    id: str
    label: str
    name: str
    properties: dict[str, Any] = {}

    @field_validator("id")
    @classmethod
    def snake_case_id(cls, v: str) -> str:
        if " " in v:
            raise ValueError(f"Node id must not contain spaces, got {v!r}")
        return v.lower()

class Edge(BaseModel):
    source: str
    target: str
    type: str

class GraphResult(BaseModel):
    nodes: List[Node]
    edges: List[Edge]
    raw_llm_response: str = ""
