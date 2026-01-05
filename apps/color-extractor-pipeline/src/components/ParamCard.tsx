interface ParamCardProps {
  title: string;
  dotColor: string;
  children: React.ReactNode;
}

export function ParamCard({ title, dotColor, children }: ParamCardProps) {
  return (
    <div className="w-[80%] bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
        <span className="font-medium text-gray-800">{title}</span>
      </div>
      {children}
    </div>
  );
}

