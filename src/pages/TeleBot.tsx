import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Bot, Loader2, Wrench } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";

const TeleBot = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useAdmin();

  // Loading states
  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="glass-card max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-bold text-foreground mb-4">Access Denied</h2>
            <p className="text-muted-foreground mb-6">Please login to access this page.</p>
            <Button onClick={() => navigate('/auth')}>Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not admin - Show maintenance message
  if (!isAdmin) {
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
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Bot className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">TELEBOT</h1>
                <p className="text-xs text-muted-foreground">Telegram Bot Manager</p>
              </div>
            </div>
          </div>
        </header>

        {/* Maintenance Message */}
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-purple-500/5">
            <CardContent className="p-8 text-center">
              <div className="p-4 rounded-full bg-purple-500/20 w-fit mx-auto mb-6">
                <Wrench className="w-12 h-12 text-purple-500" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-4">Under Maintenance</h2>
              <p className="text-muted-foreground mb-2">
                This feature is currently under maintenance and not available to the public.
              </p>
              <p className="text-sm text-muted-foreground">
                Please check back later or contact support for more information.
              </p>
              <div className="mt-6 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <p className="text-xs text-purple-400">
                  Status: <span className="font-semibold">Maintenance Mode</span>
                </p>
              </div>
              <Button 
                onClick={() => navigate("/dashboard")} 
                className="mt-6 bg-purple-500 hover:bg-purple-600"
              >
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Admin view - Full access
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
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Bot className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">TELEBOT</h1>
              <p className="text-xs text-muted-foreground">Telegram Bot Manager</p>
            </div>
          </div>
        </div>
      </header>

      {/* Admin Content - Placeholder for zip file content */}
      <main className="flex-1 container mx-auto px-4 py-8">
        <Card className="border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-purple-500/5">
          <CardContent className="p-6">
            <h2 className="text-lg font-bold text-foreground mb-4">TELEBOT Admin Panel</h2>
            <p className="text-muted-foreground">
              This is the admin-only TELEBOT management area. 
              Please paste the code from your zip file so I can integrate the full functionality here.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default TeleBot;
