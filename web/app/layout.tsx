import type { ReactNode } from "react";

export const metadata = {
  title: "NEXUS",
  description: "A living story multiverse.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          background: "#0b0b10",
          color: "#e8e8ef",
        }}
      >
        {children}
      </body>
    </html>
  );
}
