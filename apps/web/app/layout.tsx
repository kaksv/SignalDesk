import type { ReactNode } from "react";

export const metadata = {
  title: "SignalDesk",
  description: "Institutional prediction markets on Canton"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
