type SummaryCardProps = {
  label: string;
  value: string | number;
};

export function SummaryCard({ label, value }: SummaryCardProps) {
  return (
    <div className="rounded-lg border border-orange-200/80 bg-orange-50/80 p-4 shadow-xl shadow-orange-900/10 backdrop-blur-md">
      <p className="text-sm font-medium text-orange-900">{label}</p>
      <p className="mt-2 text-3xl font-bold text-rose-700">{value}</p>
    </div>
  );
}
