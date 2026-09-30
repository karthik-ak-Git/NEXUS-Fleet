import os
from typing import Optional, Dict, Any
from google import genai
from google.genai import types

class GeminiExplanationService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        self.client = None
        if self.api_key:
            try:
                self.client = genai.Client(api_key=self.api_key)
            except Exception as e:
                print(f"[GeminiService] Warning: Failed to initialize Client: {e}")

    def explain_fleet_event(self, question: str, telemetry_context: Dict[str, Any]) -> str:
        if not self.client:
            return (
                "Gemini AI explanation layer is offline (GEMINI_API_KEY not configured). "
                "The autonomous fleet simulation continues operating normally using local edge agents."
            )

        prompt = f"""
You are an expert AI Robotics & Autonomous Warehouse Operations Specialist analyzing telemetry from NEXUS-Fleet.
Your role is to provide clear, precise, natural-language explanations of autonomous robot agent decisions, path rerouting, negotiations, and deadlock resolutions.

STRICT CONSTRAINTS:
1. Base your answer strictly on the provided JSON telemetry context.
2. Never invent or hallucinate telemetry data.
3. Keep responses concise, natural, and engineering-grade (2-4 sentences max).

OPERATOR QUESTION:
"{question}"

LIVE TELEMETRY CONTEXT:
{telemetry_context}
"""
        try:
            response = self.client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.2,
                    max_output_tokens=300
                )
            )
            return response.text.strip()
        except Exception as e:
            return f"Gemini API query error: {str(e)}. Fleet simulation remains fully active."
