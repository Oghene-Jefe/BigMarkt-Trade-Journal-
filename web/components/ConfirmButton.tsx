"use client";

// Tiny confirm-on-click wrapper. Use as the submit button inside any
// destructive <form action={serverAction}>. Stops the default submit
// when the user cancels the prompt.
export default function ConfirmButton({
  children,
  message,
  className,
}: {
  children: React.ReactNode;
  message: string;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
