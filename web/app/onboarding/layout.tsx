// Onboarding sits outside the (app) shell so it has no nav drawer / header.
// Auth gate is on /onboarding/page.tsx itself.
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-bg text-white">{children}</div>;
}
