interface StepCardProps {
  step: number;
  title: string;
  dotColor: string;
  children: React.ReactNode;
}

export function StepCard({ step, title, dotColor, children }: StepCardProps) {
  return (
    <div className="w-full bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
          <span className="font-medium text-gray-800">{title}</span>
        </div>
        <span className="text-xs text-gray-400 border border-gray-200 px-2.5 py-1 rounded-full">
          Step {step}
        </span>
      </div>
      {children}
    </div>
  );
}

