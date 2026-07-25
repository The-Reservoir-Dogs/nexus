"use client";
import Editor from "@monaco-editor/react";

/** Monaco-backed manuscript editor (isolated so tests can mock it). */
export function Manuscript({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="h-full overflow-hidden rounded-lg border border-line" data-testid="manuscript-wrap">
      <Editor
        height="100%"
        defaultLanguage="markdown"
        theme="vs-dark"
        value={value}
        onChange={(v) => onChange(v ?? "")}
        options={{
          fontSize: 14,
          wordWrap: "on",
          minimap: { enabled: false },
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          padding: { top: 12 },
        }}
      />
    </div>
  );
}
