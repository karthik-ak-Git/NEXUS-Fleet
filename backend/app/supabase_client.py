from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Optional
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("nexusfleet.supabase")

class SupabaseService:
    def __init__(self):
        self.url: str = os.getenv("SUPABASE_URL", "")
        self.key: str = os.getenv("SUPABASE_ANON_KEY", os.getenv("SUPABASE_KEY", ""))
        self.client: Optional[Any] = None

        if self.url and self.key and not self.url.startswith("https://your-supabase"):
            try:
                from supabase import create_client
                self.client = create_client(self.url, self.key)
                logger.info(f"Supabase client connected successfully to {self.url}")
            except Exception as e:
                logger.warning(f"Failed to initialize Supabase client ({e}). Operating with local database persistence.")
        else:
            logger.info("Supabase credentials not yet configured in .env. Operating with local database persistence.")

    def is_configured(self) -> bool:
        return self.client is not None

    def sync_task(self, task_data: Dict[str, Any]):
        if not self.client:
            return
        try:
            self.client.table("tasks").upsert(task_data).execute()
        except Exception as e:
            logger.error(f"Error syncing task to Supabase: {e}")

    def sync_audit_log(self, audit_data: Dict[str, Any]):
        if not self.client:
            return
        try:
            self.client.table("audit_logs").insert(audit_data).execute()
        except Exception as e:
            logger.error(f"Error syncing audit log to Supabase: {e}")

    def fetch_tasks(self) -> List[Dict[str, Any]]:
        if not self.client:
            return []
        try:
            res = self.client.table("tasks").select("*").execute()
            return res.data or []
        except Exception as e:
            logger.error(f"Error fetching tasks from Supabase: {e}")
            return []

supabase_service = SupabaseService()
