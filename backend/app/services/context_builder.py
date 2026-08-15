class ContextBuilder:
    def _format_props(self, props: dict) -> str:
        if not props:
            return ""
        # Exclude structural keys and large embeddings
        clean_props = {k: v for k, v in props.items() if k not in ["id", "name", "embedding", "label"]}
        if not clean_props:
            return ""
        return f" (Details: {clean_props})"

    def build_grounded_context(self, raw_neo4j_records: list[dict]) -> list[dict]:
        """
        Takes raw 2-hop Neo4j records and structures them into a clean format for the LLM.
        """
        formatted_context = []
        for record in raw_neo4j_records:
            anchor_name = record.get("name")
            anchor_props = self._format_props(record.get("props", {}))
            neighborhood = record.get("context_neighborhood", [])
            
            relationships = []
            for neighbor in neighborhood:
                rel_type = neighbor.get("relationship")
                rel_props = self._format_props(neighbor.get("rel_props", {}))
                target = neighbor.get("node_name")
                target_props = self._format_props(neighbor.get("node_props", {}))
                
                if rel_type and target:
                    relationships.append(f"is {rel_type}{rel_props} {target}{target_props}")
            
            formatted_context.append({
                "entity": f"{anchor_name}{anchor_props}",
                "score": record.get("score"),
                "facts": relationships
            })
            
        return formatted_context

context_builder = ContextBuilder()
