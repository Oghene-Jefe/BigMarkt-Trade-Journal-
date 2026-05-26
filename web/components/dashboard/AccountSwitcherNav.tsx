"use client";

import { useRouter } from "next/navigation";
import AccountSwitcher, { type SwitcherAccount } from "./AccountSwitcher";

type Props = {
  accounts: SwitcherAccount[];
  selectedId: string | null;
};

export default function AccountSwitcherNav({ accounts, selectedId }: Props) {
  const router = useRouter();

  function handleSelect(id: string) {
    const params = new URLSearchParams(window.location.search);
    params.set("account", id);
    router.push(`/dashboard?${params.toString()}`);
  }

  return (
    <AccountSwitcher
      accounts={accounts}
      selectedId={selectedId}
      onSelect={handleSelect}
    />
  );
}
