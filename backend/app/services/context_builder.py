class ContextBuilder:
    def build_grounded_context(self, raw_neo4j_records: list[dict]) -> list[dict]:
        """
        Takes raw 2-hop Neo4j records and structures them into a clean format for the LLM.
        """
        formatted_context = []
        for record in raw_neo4j_records:
            anchor_name = record.get("name")
            neighborhood = record.get("context_neighborhood", [])
            
            relationships = []
            for neighbor in neighborhood:
                rel_type = neighbor.get("relationship")
                target = neighbor.get("node_name")
                if rel_type and target:
                    relationships.append(f"is {rel_type} {target}")
            
            formatted_context.append({
                "entity": anchor_name,
                "score": record.get("score"),
                "facts": relationships
            })
            
        return formatted_context

context_builder = ContextBuilder()
