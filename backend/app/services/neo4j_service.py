import logging
from contextlib import asynccontextmanager

from neo4j import AsyncGraphDatabase, AsyncDriver
from neo4j.exceptions import ServiceUnavailable

from app.core.config import settings
from app.models.graph_models import GraphResult, Node, Edge

logger = logging.getLogger(__name__)

class Neo4jService:
    def __init__(self):
        self._driver: AsyncDriver | None = None

    async def connect(self) -> None:
        self._driver = AsyncGraphDatabase.driver(
            settings.NEO4J_URI,
            auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
        )
        await self._driver.verify_connectivity()
        logger.info("Neo4j connected")
        
        await self._create_indexes()
        await self._create_vector_index()

    async def disconnect(self) -> None:
        if self._driver:
            await self._driver.close()
            logger.info("Neo4j disconnected")

    def _require_driver(self) -> AsyncDriver:
        if not self._driver:
            raise RuntimeError("Neo4jService not connected.")
        return self._driver

    async def _create_indexes(self) -> None:
        constraints = [
            "CREATE CONSTRAINT entity_id_unique IF NOT EXISTS FOR (n:Entity) REQUIRE n.id IS UNIQUE",
            "CREATE CONSTRAINT person_id_unique IF NOT EXISTS FOR (n:Person) REQUIRE n.id IS UNIQUE",
            "CREATE CONSTRAINT event_id_unique IF NOT EXISTS FOR (n:Event) REQUIRE n.id IS UNIQUE",
            "CREATE CONSTRAINT topic_id_unique IF NOT EXISTS FOR (n:Topic) REQUIRE n.id IS UNIQUE",
            "CREATE CONSTRAINT conversation_id_unique IF NOT EXISTS FOR (n:Conversation) REQUIRE n.id IS UNIQUE",
            "CREATE CONSTRAINT memory_id_unique IF NOT EXISTS FOR (n:Memory) REQUIRE n.id IS UNIQUE",
        ]
        driver = self._require_driver()
        async with driver.session() as session:
            for cypher in constraints:
                await session.run(cypher)
        logger.info("Neo4j indexes/constraints verified")

    async def _create_vector_index(self) -> None:
        cypher = """
        CREATE VECTOR INDEX entity_embeddings IF NOT EXISTS
        FOR (a:Entity) ON (a.embedding)
        OPTIONS {
            indexConfig: {
                `vector.dimensions`: 768,
                `vector.similarity_function`: 'cosine'
            }
        }
        """
        driver = self._require_driver()
        async with driver.session() as session:
            await session.run(cypher)
        logger.info("Neo4j vector index 'entity_embeddings' verified")

    async def write_node(self, node: Node) -> None:
        cypher = f"""
        MERGE (n:{node.label} {{id: $id}})
        SET n += $props
        RETURN n
        """
        props = {"id": node.id, "name": node.name, **node.properties}
        driver = self._require_driver()
        async with driver.session() as session:
            await session.run(cypher, id=node.id, props=props)

    async def write_edge(self, edge: Edge) -> None:
        cypher = f"""
        MATCH (a {{id: $source}}), (b {{id: $target}})
        MERGE (a)-[r:{edge.type}]->(b)
        RETURN r
        """
        driver = self._require_driver()
        async with driver.session() as session:
            result = await session.run(cypher, source=edge.source, target=edge.target)
            record = await result.single()
            if record is None:
                logger.warning(f"Edge not created — missing nodes: {edge.source} -[{edge.type}]-> {edge.target}")

    async def write_graph_result(self, result: GraphResult) -> dict:
        for node in result.nodes:
            await self.write_node(node)
        for edge in result.edges:
            await self.write_edge(edge)
        return {
            "nodes_written": len(result.nodes),
            "edges_written": len(result.edges),
        }

    async def search_semantic_with_context(self, query_embedding: list[float], top_k: int = 3) -> list[dict]:
        """
        Finds the top semantic matches and traverses their graph neighborhood (2-hop).
        """
        cypher = """
        CALL db.index.vector.queryNodes('entity_embeddings', $top_k, $query_embedding)
        YIELD node AS primaryNode, score
        
        // 2-hop traversal
        OPTIONAL MATCH (primaryNode)-[r1]-(neighbor1)
        OPTIONAL MATCH (neighbor1)-[r2]-(neighbor2)
        WHERE neighbor2 <> primaryNode
        
        WITH primaryNode, score,
             collect(DISTINCT {
                 relationship: type(r1), 
                 rel_props: properties(r1),
                 node_label: labels(neighbor1)[0],
                 node_name: neighbor1.name,
                 node_id: neighbor1.id,
                 node_props: properties(neighbor1)
             }) AS hop1_context,
             collect(DISTINCT {
                 relationship: type(r2), 
                 rel_props: properties(r2),
                 node_label: labels(neighbor2)[0],
                 node_name: neighbor2.name,
                 node_id: neighbor2.id,
                 node_props: properties(neighbor2)
             }) AS hop2_context
             
        RETURN {
            id: primaryNode.id,
            name: primaryNode.name,
            props: properties(primaryNode),
            score: score,
            context_neighborhood: [c IN (hop1_context + hop2_context) WHERE c.node_id IS NOT NULL]
        } AS result
        """
        driver = self._require_driver()
        async with driver.session() as session:
            result = await session.run(cypher, top_k=top_k, query_embedding=query_embedding)
            records = await result.data()
            return [record["result"] for record in records]

neo4j_service = Neo4jService()
