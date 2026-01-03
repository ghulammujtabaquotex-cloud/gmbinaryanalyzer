import { useNavigate } from 'react-router-dom';
import { Crown, Check, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useSubscription } from '@/hooks/useSubscription';
import { PAYMENT_CONFIG, VIP_FEATURES } from '@/lib/paymentConfig';

const Pricing = () => {
  const navigate = useNavigate();
  const { isVip, isLoading } = useSubscription();

  const handleJoinVIP = () => {
    // Open WhatsApp with pre-filled message
    window.open('https://wa.me/923313063104?text=I%20want%20to%20join%20your%20VIP', '_blank');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
          <h1 className="text-xl font-bold text-gradient">GM Binary Pro</h1>
          <div className="w-20" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-5xl">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 mb-6">
            <Crown className="w-5 h-5 text-primary" />
            <span className="text-primary font-semibold">VIP Membership</span>
          </div>
          <h2 className="text-4xl font-bold text-foreground mb-4">
            Unlock More Analysis Power
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Get {PAYMENT_CONFIG.vipDailyLimit} daily analyses and exclusive VIP features to maximize your trading potential
          </p>
        </div>

        {/* Already VIP */}
        {isVip && (
          <Card className="glass-card glow-primary max-w-md mx-auto mb-8">
            <CardContent className="p-6 text-center">
              <Crown className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-bold text-foreground mb-2">You're a VIP Member!</h3>
              <p className="text-muted-foreground">
                Enjoy {PAYMENT_CONFIG.vipDailyLimit} analyses per day and all premium features.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="grid lg:grid-cols-2 gap-8 max-w-4xl mx-auto">
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
                  <span>{PAYMENT_CONFIG.freeDailyLimit} analyses per day</span>
                </li>
                <li className="flex items-center gap-3 text-muted-foreground">
                  <Check className="w-5 h-5 text-success flex-shrink-0" />
                  <span>Basic chart analysis</span>
                </li>
                <li className="flex items-center gap-3 text-muted-foreground">
                  <Check className="w-5 h-5 text-success flex-shrink-0" />
                  <span>Support/Resistance levels</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* VIP Tier */}
          <Card className="glass-card glow-primary relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 text-xs font-bold rounded-bl-lg">
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
                <span className="block text-sm text-muted-foreground mt-1">
                  or Rs. {PAYMENT_CONFIG.pakistanBankPrice} PKR
                </span>
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

              {isVip ? (
                <Button className="w-full" disabled>
                  <Crown className="w-4 h-4 mr-2" />
                  Already VIP
                </Button>
              ) : (
                <Button
                  className="w-full relative overflow-hidden bg-gradient-to-r from-primary via-primary/80 to-primary hover:from-primary/90 hover:via-primary hover:to-primary/90 text-primary-foreground font-bold shadow-[0_0_20px_hsl(var(--primary)/0.5)] hover:shadow-[0_0_30px_hsl(var(--primary)/0.7)] transition-all duration-300"
                  size="lg"
                  onClick={handleJoinVIP}
                >
                  <Crown className="w-5 h-5 mr-2" />
                  Join VIP via WhatsApp
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Contact Info */}
        <div className="text-center mt-12 space-y-4">
          <p className="text-muted-foreground">
            For any questions, contact us on WhatsApp
          </p>
          <a
            href="https://wa.me/923313063104?text=I%20want%20to%20join%20your%20VIP"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-success font-semibold hover:underline"
          >
            +923313063104
          </a>
        </div>
      </main>
    </div>
  );
};

export default Pricing;
