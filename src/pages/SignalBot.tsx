import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Zap } from "lucide-react";

const SignalBot = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Zap className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Signal Bot</h1>
              <p className="text-xs text-muted-foreground">Future Signal Generator</p>
            </div>
          </div>
        </div>
      </header>

      {/* Iframe Container */}
      <main className="flex-1">
        <iframe
          src="https://futuresignalbot.vercel.app"
          className="w-full h-full min-h-[calc(100vh-73px)] border-0"
          title="Future Signal Bot"
          allow="clipboard-write"
        />
      </main>
    </div>
  );
};

export default SignalBot;
