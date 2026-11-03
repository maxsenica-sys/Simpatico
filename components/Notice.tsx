"use client";
import type { ReactNode } from "react";

export function Notice({ title, body, children, tone = "plain" }: { title: string; body?: ReactNode; children?: ReactNode; tone?: "plain" | "warn" }) {
  return (
    <main className="screen center">
      <div className={`card notice ${tone}`}>
        <h1>{title}</h1>
        {body && <div className="muted body">{body}</div>}
        {children && <div className="actions">{children}</div>}
      </div>
    </main>
  );
}
