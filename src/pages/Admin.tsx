import { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Crown, Send, Hash, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { toast } from 'sonner';

// Lazy load the GM Live Bot
const GMLiveBot = lazy(() => import('@/gmlivebot/components/GMLiveBot'));

const Admin = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  
  // Future Signals Telegram Settings
  const [telegramEnabled, setTelegramEnabled] = useState(true);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [chatId, setChatId] = useState('');
  const [chatIdLoading, setChatIdLoading] = useState(false);
  
  // GM Live Bot fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fetch settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      // Future Signals settings
      const { data: telegramData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('id', 'telegram_auto_send')
        .maybeSingle();
      
      if (telegramData) {
        const value = telegramData.value as { enabled?: boolean; chat_id?: string };
        setTelegramEnabled(value?.enabled !== false);
        setChatId(value?.chat_id || '');
      }
    };
    fetchSettings();
  }, []);

  const toggleTelegram = async () => {
    setTelegramLoading(true);
    try {
      const newValue = !telegramEnabled;
      const { error } = await supabase
        .from('app_settings')
        .upsert({ 
          id: 'telegram_auto_send', 
          value: { enabled: newValue, chat_id: chatId || undefined },
          updated_at: new Date().toISOString()
        });
      
      if (error) throw error;
      
      setTelegramEnabled(newValue);
      toast.success(`Future Signals Telegram ${newValue ? 'enabled' : 'disabled'}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update setting');
    }
    setTelegramLoading(false);
  };

  const saveChatId = async () => {
    setChatIdLoading(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({ 
          id: 'telegram_auto_send', 
          value: { enabled: telegramEnabled, chat_id: chatId || undefined },
          updated_at: new Date().toISOString()
        });
      
      if (error) throw error;
      toast.success('Chat ID saved successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save Chat ID');
    }
    setChatIdLoading(false);
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

      <main className="container mx-auto px-4 py-8 max-w-4xl space-y-6">

        {/* #TELE - GM Live Bot Section */}
        <Card className="bg-card/50 border-green-500/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Hash className="w-5 h-5 text-green-400" />
                <h2 className="text-lg font-bold text-foreground">TELE - GM Live Bot</h2>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="border-green-500/50 text-green-500 hover:bg-green-500/10"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </Button>
            </div>
            
            <div className={`bg-black rounded-lg overflow-hidden border border-[#2a2e39] ${isFullscreen ? 'fixed inset-4 z-[100]' : 'h-[600px]'}`}>
              {isFullscreen && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsFullscreen(false)}
                  className="absolute top-2 right-2 z-[101] border-green-500/50 text-green-500 hover:bg-green-500/10"
                >
                  <Minimize2 className="w-4 h-4" />
                </Button>
              )}
              <Suspense fallback={
                <div className="h-full flex items-center justify-center bg-black">
                  <Loader2 className="w-8 h-8 animate-spin text-green-500" />
                </div>
              }>
                <GMLiveBot />
              </Suspense>
            </div>
          </CardContent>
        </Card>

        {/* Future Signals Telegram Settings */}
        <Card className="bg-card/50 border-cyan-500/30">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Send className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-bold text-foreground">Future Signals Telegram</h2>
            </div>
            
            <div className="space-y-4">
              {/* Toggle */}
              <div className="flex items-center justify-between bg-background/50 rounded-lg px-4 py-3">
                <div className="flex items-center gap-3">
                  <Send className={`h-5 w-5 ${telegramEnabled ? 'text-cyan-400' : 'text-muted-foreground'}`} />
                  <span className="text-foreground">Auto-Send Future Signals</span>
                </div>
                <Switch
                  checked={telegramEnabled}
                  onCheckedChange={toggleTelegram}
                  disabled={telegramLoading}
                  className="data-[state=checked]:bg-cyan-500"
                />
              </div>

              {/* Chat ID */}
              <div className="bg-background/50 rounded-lg px-4 py-3">
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  Telegram Chat ID
                </label>
                <div className="flex gap-2">
                  <Input
                    value={chatId}
                    onChange={(e) => setChatId(e.target.value)}
                    placeholder="Enter channel/group chat ID"
                    className="flex-1 bg-background"
                  />
                  <Button
                    onClick={saveChatId}
                    disabled={chatIdLoading}
                    variant="outline"
                    className="border-cyan-500/50 text-cyan-500 hover:bg-cyan-500/10"
                  >
                    {chatIdLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Leave empty to use default channel. Format: -1001234567890
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

      </main>
    </div>
  );
};

export default Admin;
