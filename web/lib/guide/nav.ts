export type GuideLink = { href: string; label: string };
export type GuideGroup = { label: string; items: GuideLink[] };

export const GUIDE_NAV: GuideGroup[] = [
  {
    label: "Getting Started",
    items: [
      { href: "/guide/create-account", label: "Create Your Account" },
      { href: "/guide/onboarding", label: "Onboarding" },
      { href: "/guide/dashboard-tour", label: "Dashboard Tour" },
      { href: "/guide/set-up-profile", label: "Set Up Your Profile" },
    ],
  },
  {
    label: "Journaling Trades",
    items: [
      { href: "/guide/log-a-trade", label: "Log a Trade" },
      { href: "/guide/chart-screenshots", label: "Chart Screenshots" },
      { href: "/guide/edit-or-delete-a-trade", label: "Edit or Delete a Trade" },
      { href: "/guide/trade-visibility", label: "Trade Visibility" },
      { href: "/guide/multi-account-management", label: "Multi-Account Management" },
    ],
  },
  {
    label: "Verified Auto-Capture",
    items: [
      { href: "/guide/how-verification-works", label: "How Verification Works" },
      { href: "/guide/install-the-ea", label: "Install the EA" },
      { href: "/guide/broker-compatibility", label: "Broker Compatibility" },
      { href: "/guide/automated-mode-tos", label: "Automated Mode & TOS" },
      { href: "/guide/capture-troubleshooting", label: "Troubleshooting Capture" },
    ],
  },
  {
    label: "Trading Tools",
    items: [
      { href: "/guide/risk-calculator", label: "Risk Calculator" },
      { href: "/guide/trading-constitution", label: "Trading Constitution" },
      { href: "/guide/challenges", label: "Challenges" },
    ],
  },
  {
    label: "Analytics & Reports",
    items: [
      { href: "/guide/dashboard-analytics", label: "Dashboard Analytics" },
      { href: "/guide/advanced-analytics", label: "Advanced Analytics" },
      { href: "/guide/monthly-heatmap", label: "Monthly Heatmap" },
      { href: "/guide/report-cards-export", label: "Report Cards & Export" },
    ],
  },
  {
    label: "Community & Social",
    items: [
      { href: "/guide/discover", label: "Discover" },
      { href: "/guide/following", label: "Following" },
      { href: "/guide/feed", label: "Feed" },
      { href: "/guide/reactions", label: "Reactions" },
      { href: "/guide/leaderboard", label: "Leaderboard" },
      { href: "/guide/public-profile", label: "Public Profile" },
      { href: "/guide/disputes", label: "Disputes" },
    ],
  },
  {
    label: "Notifications",
    items: [{ href: "/guide/notifications", label: "Notifications" }],
  },
  {
    label: "Plans & Referrals",
    items: [
      { href: "/guide/free-vs-pro", label: "Free vs Pro" },
      { href: "/guide/referrals", label: "Referral Program" },
    ],
  },
  {
    label: "Security & Privacy",
    items: [
      { href: "/guide/security-model", label: "Security Model" },
      { href: "/guide/public-vs-private", label: "Public vs Private" },
      { href: "/guide/data-rights", label: "Your Data Rights" },
    ],
  },
  {
    label: "Help",
    items: [
      { href: "/guide/faq", label: "FAQ" },
      { href: "/guide/contact-support", label: "Contact Support" },
    ],
  },
];
