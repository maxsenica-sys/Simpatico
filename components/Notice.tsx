"use client";
import type { ReactNode } from "react";

export function Notice({ title, body, children, tone = "plain", icon }: { title: string; body?: ReactNode; children?: ReactNode; tone?: "plain" | "warn"; icon?: string }) {
  return (
    <main className="screen center">
      <div className={`card notice ${tone}`}>
        {icon && (
          <div className="notice-icon" aria-hidden="true">
            {icon}
          </div>
        )}
        <h1>{title}</h1>
        {body && <div className="muted body">{body}</div>}
        {children && <div className="actions">{children}</div>}
      </div>
    </main>
  );
}
