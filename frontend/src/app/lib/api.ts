// Base URLs for the three backend services. Defaults keep local development
// working with no .env; set these in the environment to deploy elsewhere.
export const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

// FastAPI LangGraph agent (AI/Agent/server.py)
export const AGENT_BASE =
    process.env.NEXT_PUBLIC_AGENT_BASE ?? "http://127.0.0.1:8080";

// FastAPI face embedding service (AI/face_embedding.py)
export const FACE_BASE =
    process.env.NEXT_PUBLIC_FACE_BASE ?? "http://127.0.0.1:8001";
