"use client";

import { useEffect } from "react";
import { migrateFromIndexedDBOnce } from "@/lib/db/migrateFromIndexedDB";

export function BootMigration() {
  useEffect(() => {
    void migrateFromIndexedDBOnce();
  }, []);
  return null;
}
