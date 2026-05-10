import httpx
from typing import List, Dict, AsyncGenerator
import json

LLAMA_CPP_URL = "http://localhost:8080"

async def send_to_llm(messages: List[Dict[str, str]], temperature: float = 0.7) -> AsyncGenerator[str, None]:
    payload = {
        "messages": messages,
        "temperature": temperature,
        "stream": True
    }
    
    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream(
            "POST",
            f"{LLAMA_CPP_URL}/v1/chat/completions",
            json=payload,
            headers={"Content-Type": "application/json"}
        ) as response:
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    data = line[6:]
                    if data != "[DONE]":
                        try:
                            chunk = json.loads(data)
                            content = chunk.get("choices", [{}])[0].get("delta", {}).get("content")
                            if content:
                                yield content
                        except:
                            continue