import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Crown, Globe, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { usePublicAccess } from '@/hooks/usePublicAccess';
import { toast } from 'sonner';
import { useState } from 'react';

const Admin = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const { enabled: publicAccess, isLoading: settingLoading, setPublicAccess } = usePublicAccess();
  const [saving, setSaving] = useState(false);

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

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

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="glass-card max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-bold text-foreground mb-4">Admin Access Required</h2>
            <p className="text-muted-foreground mb-6">You don't have permission to access this page.</p>
            <Button onClick={() => navigate('/')}>Back to Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleToggle = async (checked: boolean) => {
    setSaving(true);
    try {
      await setPublicAccess(checked);
      toast.success(
        checked
          ? "Public access ENABLED — all users can access tools"
          : "Public access DISABLED — only VIP & Admins can access tools"
      );
    } catch (e) {
      console.error(e);
      toast.error("Failed to update setting");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="text-muted-foreground hover:text-foreground">
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

      <main className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
        <Card className="glass-card border-amber-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              {publicAccess ? (
                <Globe className="w-5 h-5 text-green-500" />
              ) : (
                <Lock className="w-5 h-5 text-amber-400" />
              )}
              Public Access Control
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between gap-4 p-4 rounded-lg bg-muted/30 border border-border/50">
              <div className="space-y-1 flex-1">
                <p className="font-semibold text-foreground">
                  {publicAccess ? "All Modes Enabled (Public)" : "Restricted Mode (VIP & Admin Only)"}
                </p>
                <p className="text-sm text-muted-foreground">
                  When ON, all users (including free) can use Future Signals and Live Bot.
                  When OFF, free users see a "Contact on WhatsApp" screen — only VIP & Admins keep access.
                </p>
              </div>
              <Switch
                checked={publicAccess}
                disabled={saving || settingLoading}
                onCheckedChange={handleToggle}
              />
            </div>

            <div className={`text-sm p-3 rounded-lg border ${publicAccess ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'}`}>
              Status:{" "}
              <strong>
                {publicAccess ? "PUBLIC — Everyone has access" : "PRIVATE — Free users blocked"}
              </strong>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Admin;
