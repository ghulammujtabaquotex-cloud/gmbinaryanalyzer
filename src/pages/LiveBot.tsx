import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const LiveBot = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <div className="h-4 w-px bg-border" />
            <h1 className="text-lg font-semibold text-foreground">LIVE BOT</h1>
          </div>
        </div>
      </header>

      {/* Iframe Container */}
      <div className="flex-1 w-full">
        <iframe
          src="https://gm-analyzer-2.vercel.app"
          className="w-full h-full border-0"
          style={{ minHeight: 'calc(100vh - 57px)' }}
          title="Live Bot Trading Terminal"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
};

export default LiveBot;
