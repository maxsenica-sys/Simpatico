"use client";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportError } from "@/lib/errors";
import { useT } from "@/lib/i18n";

/**
 * If any screen crashes, show a calm "Something went wrong" with buttons that always work
 * (they reload the page) instead of a frozen screen, and send the error to the dashboard.
 */
export class CrashGuard extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false };
  static getDerivedStateFromError() {
    return { crashed: true };
  }
  componentDidCatch(err: Error, info: ErrorInfo) {
    reportError(`render: ${err.message}`, `${err.stack ?? ""}\n${info.componentStack ?? ""}`);
  }
  render() {
    return this.state.crashed ? <Crashed /> : this.props.children;
  }
}

function Crashed() {
  const t = useT();
  return (
    <main className="screen center">
      <div className="card notice">
        <h1>{t("crashTitle")}</h1>
        <div className="muted body">
          <p>{t("crashBody")}</p>
        </div>
        <div className="actions">
          <button className="btn primary big" onClick={() => location.reload()}>
            {t("crashRetry")}
          </button>
          <button className="btn big secondary" onClick={() => location.assign("/")}>
            {t("backHome")}
          </button>
        </div>
      </div>
    </main>
  );
}
