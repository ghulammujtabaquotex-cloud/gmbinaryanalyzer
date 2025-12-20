import { Activity } from "lucide-react";

export function LoadingAnalysis() {
  return (
    <div className="p-8 rounded-xl glass-card gradient-border text-center space-y-4">
      <div className="relative inline-flex">
        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
          <Activity className="w-8 h-8 text-primary animate-pulse" />
        </div>
        <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" />
      </div>
      <div className="space-y-2">
        <p className="text-foreground font-medium">Analyzing Chart...</p>
        <p className="text-sm text-muted-foreground">
          Detecting patterns, support & resistance zones
        </p>
      </div>
      <div className="flex justify-center gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-primary animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
