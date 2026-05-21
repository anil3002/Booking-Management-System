type IconProps = {
  className?: string;
};

export function CheckInIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 19V9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10" />
      <path d="M4 13h16" />
      <path d="M7 13v-2a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M12 5V3" />
      <path d="M9 3h6" />
      <path d="M16 17h4" />
      <path d="M18 15v4" />
    </svg>
  );
}

export function CheckOutIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 19V9a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v2" />
      <path d="M4 13h9" />
      <path d="M7 13v-2a2 2 0 0 1 2-2h2" />
      <path d="M14 17h7" />
      <path d="M18 13l4 4-4 4" />
    </svg>
  );
}

export function UpcomingBookingsIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <path d="M3 10h18" />
      <path d="M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
      <path d="M9 15h6" />
      <path d="M12 12v6" />
    </svg>
  );
}
