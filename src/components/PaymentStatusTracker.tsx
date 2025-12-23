import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, CheckCircle, XCircle, Clock, Copy, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PaymentStatusTrackerProps {
  accessToken: string;
  onBack: () => void;
}

type PaymentStatus = 'pending' | 'approved' | 'rejected';

interface PaymentData {
  id: string;
  status: PaymentStatus;
  email: string;
  generated_password: string | null;
  created_at: string;
}

export const PaymentStatusTracker = ({ accessToken, onBack }: PaymentStatusTrackerProps) => {
  const navigate = useNavigate();
  const [payment, setPayment] = useState<PaymentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);

  const fetchPaymentStatus = async () => {
    try {
      // Use secure RPC function to get payment by token
      const { data, error } = await supabase
        .rpc('get_payment_by_token', { p_token: accessToken });

      if (error) {
        console.error('Error fetching payment status:', error);
        return;
      }

      // RPC returns array, get first result
      const paymentData = data?.[0] || null;
      setPayment(paymentData as PaymentData | null);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!accessToken) {
      setIsLoading(false);
      return;
    }

    fetchPaymentStatus();

    // Poll for status updates every 5 seconds while pending
    const interval = setInterval(() => {
      if (!payment || payment.status === 'pending') {
        fetchPaymentStatus();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [accessToken, payment?.status]);

  const copyToClipboard = async (text: string, type: 'email' | 'password') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'email') {
        setCopiedEmail(true);
        setTimeout(() => setCopiedEmail(false), 2000);
      } else {
        setCopiedPassword(true);
        setTimeout(() => setCopiedPassword(false), 2000);
      }
      toast.success(`${type === 'email' ? 'Email' : 'Password'} copied!`);
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Pending status
  if (payment?.status === 'pending') {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <h1 className="text-xl font-bold text-gradient">GM Binary Pro</h1>
            <div className="w-20" />
          </div>
        </header>

        <main className="container mx-auto px-4 py-12 flex items-center justify-center min-h-[60vh]">
          <Card className="glass-card border-warning/50 max-w-md w-full">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-warning/20 flex items-center justify-center mx-auto mb-6">
                <Clock className="w-10 h-10 text-warning animate-pulse" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Payment Under Review
              </h2>
              <p className="text-muted-foreground mb-2">
                Your payment proof is being reviewed.
              </p>
              <p className="text-muted-foreground mb-6">
                You'll see your login credentials here once approved.
              </p>
              <div className="bg-secondary/50 rounded-lg p-3 mb-4">
                <p className="text-xs text-muted-foreground">
                  Save this page URL to check your status later
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Checking for updates...</span>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Rejected status
  if (payment?.status === 'rejected') {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Home
            </Button>
            <h1 className="text-xl font-bold text-gradient">GM Binary Pro</h1>
            <div className="w-20" />
          </div>
        </header>

        <main className="container mx-auto px-4 py-12 flex items-center justify-center min-h-[60vh]">
          <Card className="glass-card border-destructive/50 max-w-md w-full">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-10 h-10 text-destructive" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Payment Rejected
              </h2>
              <p className="text-muted-foreground mb-6">
                Unfortunately, your payment could not be verified. Please ensure you've sent the correct amount and try again.
              </p>
              <Button onClick={() => navigate('/pricing')} className="w-full">
                Try Again
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Approved status - show credentials
  if (payment?.status === 'approved' && payment.generated_password) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Home
            </Button>
            <h1 className="text-xl font-bold text-gradient">GM Binary Pro</h1>
            <div className="w-20" />
          </div>
        </header>

        <main className="container mx-auto px-4 py-12 flex items-center justify-center min-h-[60vh]">
          <Card className="glass-card glow-success max-w-md w-full">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-success" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Payment Approved!
              </h2>
              <p className="text-muted-foreground mb-6">
                Your VIP account has been created. Here are your login credentials:
              </p>

              {/* Credentials */}
              <div className="space-y-4 text-left">
                {/* Email */}
                <div className="bg-secondary/50 p-4 rounded-xl border border-border">
                  <p className="text-sm text-muted-foreground mb-2">Email</p>
                  <div className="flex items-center gap-2">
                    <code className="bg-background px-3 py-2 rounded-lg text-foreground font-mono text-sm flex-1 truncate">
                      {payment.email}
                    </code>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => copyToClipboard(payment.email, 'email')}
                    >
                      {copiedEmail ? <CheckCircle className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {/* Password */}
                <div className="bg-secondary/50 p-4 rounded-xl border border-border">
                  <p className="text-sm text-muted-foreground mb-2">Password</p>
                  <div className="flex items-center gap-2">
                    <code className="bg-background px-3 py-2 rounded-lg text-foreground font-mono text-sm flex-1 truncate">
                      {showPassword ? payment.generated_password : '••••••••••••'}
                    </code>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => copyToClipboard(payment.generated_password!, 'password')}
                    >
                      {copiedPassword ? <CheckCircle className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground mt-4 mb-6">
                Save these credentials! You'll need them to log in.
              </p>

              <Button onClick={() => navigate('/auth')} className="w-full" variant="analyze">
                Go to Login
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // No payment found or approved without password (fallback)
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Home
          </Button>
          <h1 className="text-xl font-bold text-gradient">GM Binary Pro</h1>
          <div className="w-20" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 flex items-center justify-center min-h-[60vh]">
        <Card className="glass-card max-w-md w-full">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground mb-6">
              Invalid or expired payment tracking link.
            </p>
            <Button onClick={() => navigate('/pricing')} className="w-full">
              Submit Payment
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};