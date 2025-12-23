import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, Check, ArrowLeft, Loader2, Copy, CheckCircle, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { PAYMENT_CONFIG, VIP_FEATURES } from '@/lib/paymentConfig';
import { PaymentProofUpload } from '@/components/PaymentProofUpload';
import { toast } from 'sonner';

const Pricing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isVip, pendingPayment, isLoading } = useSubscription();
  const [copied, setCopied] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  const handleCopyBinanceId = async () => {
    try {
      await navigator.clipboard.writeText(PAYMENT_CONFIG.binancePayId);
      setCopied(true);
      toast.success('Binance Pay ID copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  const handleUpgradeClick = () => {
    if (!user) {
      toast.error('Please login first to upgrade');
      navigate('/auth');
      return;
    }
    setShowUpload(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (showUpload && user) {
    return <PaymentProofUpload onBack={() => setShowUpload(false)} />;
  }

  return (
    <div className="min-h-screen bg-background">
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
          <h1 className="text-xl font-bold text-gradient">GM Binary Pro</h1>
          <div className="w-20" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 mb-6">
            <Crown className="w-5 h-5 text-primary" />
            <span className="text-primary font-semibold">VIP Membership</span>
          </div>
          <h2 className="text-4xl font-bold text-foreground mb-4">
            Unlock Unlimited Analysis Power
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Get unlimited daily analyses and exclusive VIP features to maximize your trading potential
          </p>
        </div>

        {/* Already VIP */}
        {isVip && (
          <Card className="glass-card glow-primary max-w-md mx-auto mb-8">
            <CardContent className="p-6 text-center">
              <Crown className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-bold text-foreground mb-2">You're a VIP Member!</h3>
              <p className="text-muted-foreground">
                Enjoy unlimited analyses and all premium features.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Pending Payment */}
        {pendingPayment && !isVip && (
          <Card className="glass-card border-warning/50 max-w-md mx-auto mb-8">
            <CardContent className="p-6 text-center">
              <Loader2 className="w-12 h-12 text-warning mx-auto mb-4 animate-spin" />
              <h3 className="text-xl font-bold text-foreground mb-2">Payment Under Review</h3>
              <p className="text-muted-foreground">
                Your payment proof has been submitted and is being reviewed. You'll be upgraded once approved!
              </p>
            </CardContent>
          </Card>
        )}

        <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Free Tier */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-2xl text-foreground">Free Plan</CardTitle>
              <CardDescription>Perfect for trying out</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold text-foreground">$0</span>
                <span className="text-muted-foreground">/forever</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-muted-foreground">
                  <Check className="w-5 h-5 text-success flex-shrink-0" />
                  <span>5 analyses per day</span>
                </li>
                <li className="flex items-center gap-3 text-muted-foreground">
                  <Check className="w-5 h-5 text-success flex-shrink-0" />
                  <span>Basic signal detection</span>
                </li>
                <li className="flex items-center gap-3 text-muted-foreground">
                  <Check className="w-5 h-5 text-success flex-shrink-0" />
                  <span>Standard processing speed</span>
                </li>
              </ul>
              <Button variant="outline" className="w-full mt-6" disabled>
                Current Plan
              </Button>
            </CardContent>
          </Card>

          {/* VIP Tier */}
          <Card className="glass-card glow-primary border-primary/50 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-4 py-1 text-sm font-semibold rounded-bl-lg">
              POPULAR
            </div>
            <CardHeader>
              <CardTitle className="text-2xl text-foreground flex items-center gap-2">
                <Crown className="w-6 h-6 text-primary" />
                VIP Plan
              </CardTitle>
              <CardDescription>For serious traders</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold text-primary">${PAYMENT_CONFIG.vipPrice}</span>
                <span className="text-muted-foreground">/month</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-3">
                {VIP_FEATURES.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3 text-foreground">
                    <Check className="w-5 h-5 text-primary flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              
              {!isVip && !pendingPayment && (
                <Button 
                  className="w-full mt-6" 
                  variant="analyze"
                  onClick={handleUpgradeClick}
                >
                  <Crown className="w-4 h-4 mr-2" />
                  Upgrade to VIP
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Payment Instructions */}
        {!isVip && !pendingPayment && (
          <Card className="glass-card max-w-2xl mx-auto mt-12">
            <CardHeader>
              <CardTitle className="text-xl text-foreground text-center">
                How to Pay with Binance Pay
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold flex-shrink-0">
                    1
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground">Open Binance App</h4>
                    <p className="text-muted-foreground text-sm">Go to Pay &gt; Send &gt; Send to Binance User</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold flex-shrink-0">
                    2
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground">Enter Binance Pay ID</h4>
                    <div className="flex items-center gap-2 mt-2">
                      <code className="bg-secondary px-3 py-2 rounded-lg text-primary font-mono text-sm flex-1">
                        {PAYMENT_CONFIG.binancePayId}
                      </code>
                      <Button size="sm" variant="outline" onClick={handleCopyBinanceId}>
                        {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold flex-shrink-0">
                    3
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground">Send ${PAYMENT_CONFIG.vipPrice} {PAYMENT_CONFIG.currency}</h4>
                    <p className="text-muted-foreground text-sm">Complete the payment in your Binance app</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold flex-shrink-0">
                    4
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground">Upload Payment Proof</h4>
                    <p className="text-muted-foreground text-sm">Take a screenshot and upload it below to verify your payment</p>
                  </div>
                </div>
              </div>
              
              <Button 
                className="w-full" 
                variant="analyze"
                onClick={handleUpgradeClick}
              >
                <Upload className="w-4 h-4 mr-2" />
                I've Paid - Upload Proof
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Pricing;
