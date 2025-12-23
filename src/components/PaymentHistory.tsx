import { useState, useEffect } from 'react';
import { History, Eye, EyeOff, Copy, CheckCircle, Mail, Key } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ApprovedPayment {
  email: string;
  password: string;
  approvedAt: string;
}

const PAYMENT_HISTORY_KEY = 'gm_payment_history';

export const getPaymentHistory = (): ApprovedPayment[] => {
  try {
    const history = localStorage.getItem(PAYMENT_HISTORY_KEY);
    return history ? JSON.parse(history) : [];
  } catch {
    return [];
  }
};

export const addToPaymentHistory = (email: string, password: string) => {
  const history = getPaymentHistory();
  // Check if already exists
  const exists = history.some(p => p.email === email);
  if (!exists) {
    history.unshift({
      email,
      password,
      approvedAt: new Date().toISOString(),
    });
    localStorage.setItem(PAYMENT_HISTORY_KEY, JSON.stringify(history));
  }
};

export const PaymentHistory = () => {
  const [history, setHistory] = useState<ApprovedPayment[]>([]);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [copiedItems, setCopiedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    setHistory(getPaymentHistory());
  }, []);

  const togglePasswordVisibility = (email: string) => {
    const newVisible = new Set(visiblePasswords);
    if (newVisible.has(email)) {
      newVisible.delete(email);
    } else {
      newVisible.add(email);
    }
    setVisiblePasswords(newVisible);
  };

  const copyToClipboard = async (text: string, itemKey: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItems(prev => new Set(prev).add(itemKey));
      toast.success('Copied to clipboard!');
      setTimeout(() => {
        setCopiedItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(itemKey);
          return newSet;
        });
      }, 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  if (history.length === 0) {
    return null;
  }

  return (
    <Card className="glass-card max-w-md mx-auto mb-8">
      <CardHeader className="text-center pb-2">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 border border-success/30 mx-auto mb-2">
          <History className="w-4 h-4 text-success" />
          <span className="text-success font-semibold text-sm">Payment History</span>
        </div>
        <CardTitle className="text-lg text-foreground">Your Approved Accounts</CardTitle>
        <CardDescription className="text-sm">
          VIP credentials from your approved payments
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {history.map((payment, index) => (
          <div 
            key={payment.email} 
            className="bg-secondary/50 rounded-lg p-4 border border-border space-y-3"
          >
            {/* Email */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-foreground truncate">{payment.email}</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={() => copyToClipboard(payment.email, `email-${index}`)}
              >
                {copiedItems.has(`email-${index}`) ? (
                  <CheckCircle className="w-4 h-4 text-success" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>

            {/* Password */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Key className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-foreground font-mono">
                  {visiblePasswords.has(payment.email) 
                    ? payment.password 
                    : '••••••••••••'}
                </span>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={() => togglePasswordVisibility(payment.email)}
                >
                  {visiblePasswords.has(payment.email) ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={() => copyToClipboard(payment.password, `pass-${index}`)}
                >
                  {copiedItems.has(`pass-${index}`) ? (
                    <CheckCircle className="w-4 h-4 text-success" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Approved date */}
            <p className="text-xs text-muted-foreground">
              Approved: {new Date(payment.approvedAt).toLocaleDateString()}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
