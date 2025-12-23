import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, CheckCircle, XCircle, Clock, Copy, Eye, EyeOff, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PaymentStatusTrackerProps {
  accessToken: string;
  onBack: () => void;
  onNewPayment?: () => void;
}

type PaymentStatus = 'pending' | 'approved' | 'rejected';

interface PaymentData {
  id: string;
  status: PaymentStatus;
  email: string;
  generated_password: string | null;
  created_at: string;
}

export const PaymentStatusTracker = ({ accessToken, onBack, onNewPayment }: PaymentStatusTrackerProps) => {
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
    const whatsappNumber = '+923313063104';
    const whatsappLink = `https://wa.me/${whatsappNumber.replace('+', '')}`;
    
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
              <p className="text-muted-foreground mb-4">
                Unfortunately, your payment could not be verified. Please ensure you've sent the correct amount and try again.
              </p>
              
              {/* WhatsApp Contact */}
              <div className="bg-secondary/50 rounded-lg p-4 mb-6">
                <p className="text-sm text-muted-foreground mb-2">Need help? Contact us on WhatsApp:</p>
                <a 
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-success font-semibold hover:underline"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  {whatsappNumber}
                </a>
              </div>
              
              {onNewPayment ? (
                <Button onClick={onNewPayment} className="w-full">
                  Submit New Payment
                </Button>
              ) : (
                <Button onClick={() => navigate('/pricing')} className="w-full">
                  Try Again
                </Button>
              )}
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
            {onNewPayment ? (
              <Button onClick={onNewPayment} className="w-full">
                Submit New Payment
              </Button>
            ) : (
              <Button onClick={() => navigate('/pricing')} className="w-full">
                Submit Payment
              </Button>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};