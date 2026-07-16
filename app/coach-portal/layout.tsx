import CoachPortalShell from "../../components/coach-portal-shell";

export default function CoachPortalLayout({ children }: { children: React.ReactNode }) {
  return <CoachPortalShell title="教練上堂">{children}</CoachPortalShell>;
}
