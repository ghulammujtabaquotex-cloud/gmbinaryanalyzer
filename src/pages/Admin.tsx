import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Crown, RefreshCw, Send, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { toast } from 'sonner';
import AdminFutureSignals from '@/components/AdminFutureSignals';

const Admin = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const [isTelegramTesting, setIsTelegramTesting] = useState(false);

  const handleTelegramTest = async () => {
    setIsTelegramTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("telegram-test");
      if (error) throw error;
      if (data?.success) {
        toast.success("Telegram test message sent successfully!");
      } else {
        throw new Error(data?.error || "Failed to send test message");
      }
    } catch (err) {
      console.error("Telegram test error:", err);
      toast.error("Failed to send Telegram test message");
    } finally {
      setIsTelegramTesting(false);
    }
  };

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

  // Not admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="glass-card max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-bold text-foreground mb-4">Admin Access Required</h2>
            <p className="text-muted-foreground mb-6">
              You don't have permission to access this page.
            </p>
            <Button onClick={() => navigate('/')}>Back to Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold text-gradient">Admin Panel</h1>
          </div>
          <div className="w-16" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Telegram Test Button */}
        <div className="flex justify-end mb-6">
          <Button
            onClick={handleTelegramTest}
            disabled={isTelegramTesting}
            variant="outline"
            size="sm"
            className="border-cyan-500/50 text-cyan-500 hover:bg-cyan-500/10"
          >
            {isTelegramTesting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Test Telegram
              </>
            )}
          </Button>
        </div>

        {/* Future Signals Section */}
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Future Signals</h2>
          </div>
          <AdminFutureSignals />
        </div>
      </main>
    </div>
  );
};

export default Admin;
