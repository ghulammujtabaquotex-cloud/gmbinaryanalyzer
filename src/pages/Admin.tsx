import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, X, Loader2, Crown, Clock, Eye, RefreshCw, Copy, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { PAYMENT_CONFIG } from '@/lib/paymentConfig';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface PaymentRequest {
  id: string;
  user_id: string | null;
  email: string | null;
  amount: number;
  proof_image_url: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
}

interface CreatedCredentials {
  email: string;
  password: string;
}

const Admin = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useAdmin();
  const [payments, setPayments] = useState<PaymentRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [approvingPayment, setApprovingPayment] = useState<PaymentRequest | null>(null);
  const [approvalEmail, setApprovalEmail] = useState('');
  const [createdCredentials, setCreatedCredentials] = useState<CreatedCredentials | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const fetchPayments = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('payment_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching payments:', error);
        toast.error('Failed to load payments');
      } else {
        setPayments((data as PaymentRequest[]) || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchPayments();
    }
  }, [isAdmin]);

  const getImageUrl = (path: string) => {
    const { data } = supabase.storage
      .from('payment-proofs')
      .getPublicUrl(path);
    return data.publicUrl;
  };

  const handleApproveClick = (payment: PaymentRequest) => {
    setApprovingPayment(payment);
    setApprovalEmail(payment.email || '');
    setCreatedCredentials(null);
  };

  const handleApprove = async () => {
    if (!approvingPayment || !approvalEmail) {
      toast.error('Please enter an email address');
      return;
    }

    setProcessingId(approvingPayment.id);

    try {
      // Call edge function to create user and subscription
      const { data, error } = await supabase.functions.invoke('create-vip-user', {
        body: {
          email: approvalEmail,
          paymentRequestId: approvingPayment.id,
        },
      });

      if (error) {
        console.error('Error:', error);
        toast.error('Failed to create VIP user');
        return;
      }

      if (data.error) {
        toast.error(data.error);
        return;
      }

      // Show credentials
      setCreatedCredentials({
        email: data.email,
        password: data.password,
      });

      toast.success('VIP user created successfully!');
      fetchPayments();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Something went wrong');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (payment: PaymentRequest) => {
    if (!user) return;
    setProcessingId(payment.id);

    try {
      const { error } = await supabase
        .from('payment_requests')
        .update({
          status: 'rejected',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', payment.id);

      if (error) {
        console.error('Error:', error);
        toast.error('Failed to reject payment');
        return;
      }

      toast.success('Payment rejected');
      fetchPayments();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Something went wrong');
    } finally {
      setProcessingId(null);
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.success(`${field} copied!`);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-warning/20 text-warning border-warning/30">Pending</Badge>;
      case 'approved':
        return <Badge className="bg-success/20 text-success border-success/30">Approved</Badge>;
      case 'rejected':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
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

  const pendingPayments = payments.filter(p => p.status === 'pending');
  const processedPayments = payments.filter(p => p.status !== 'pending');

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
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold text-gradient">Admin Panel</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchPayments}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card className="glass-card">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-warning">{pendingPayments.length}</div>
              <div className="text-sm text-muted-foreground">Pending</div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-success">
                {payments.filter(p => p.status === 'approved').length}
              </div>
              <div className="text-sm text-muted-foreground">Approved</div>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-destructive">
                {payments.filter(p => p.status === 'rejected').length}
              </div>
              <div className="text-sm text-muted-foreground">Rejected</div>
            </CardContent>
          </Card>
        </div>

        {/* Pending Payments */}
        <Card className="glass-card mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Clock className="w-5 h-5 text-warning" />
              Pending Payments ({pendingPayments.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : pendingPayments.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No pending payments to review
              </p>
            ) : (
              <div className="space-y-4">
                {pendingPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className="bg-secondary/30 rounded-lg p-4 flex items-center gap-4"
                  >
                    {/* Thumbnail */}
                    <button
                      onClick={() => setViewingImage(payment.proof_image_url)}
                      className="w-20 h-20 rounded-lg bg-secondary overflow-hidden flex-shrink-0 hover:opacity-80 transition-opacity"
                    >
                      <img
                        src={getImageUrl(payment.proof_image_url)}
                        alt="Payment proof"
                        className="w-full h-full object-cover"
                      />
                    </button>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-foreground">
                          ${payment.amount} {PAYMENT_CONFIG.currency}
                        </span>
                        {getStatusBadge(payment.status)}
                      </div>
                      {payment.email && (
                        <p className="text-sm text-primary truncate">
                          {payment.email}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {formatDate(payment.created_at)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setViewingImage(payment.proof_image_url)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={processingId === payment.id}
                        onClick={() => handleReject(payment)}
                      >
                        {processingId === payment.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <X className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        className="bg-success hover:bg-success/90"
                        disabled={processingId === payment.id}
                        onClick={() => handleApproveClick(payment)}
                      >
                        {processingId === payment.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Processed Payments */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-foreground">Payment History</CardTitle>
          </CardHeader>
          <CardContent>
            {processedPayments.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No processed payments yet
              </p>
            ) : (
              <div className="space-y-3">
                {processedPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className="bg-secondary/30 rounded-lg p-3 flex items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-foreground text-sm">
                          ${payment.amount}
                        </span>
                        {getStatusBadge(payment.status)}
                      </div>
                      {payment.email && (
                        <p className="text-xs text-primary">{payment.email}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {formatDate(payment.created_at)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setViewingImage(payment.proof_image_url)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Image Viewer Dialog */}
      <Dialog open={!!viewingImage} onOpenChange={() => setViewingImage(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Payment Proof</DialogTitle>
          </DialogHeader>
          {viewingImage && (
            <img
              src={getImageUrl(viewingImage)}
              alt="Payment proof"
              className="w-full rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Approval Dialog */}
      <Dialog open={!!approvingPayment} onOpenChange={() => {
        setApprovingPayment(null);
        setCreatedCredentials(null);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {createdCredentials ? 'VIP Credentials Created' : 'Approve Payment'}
            </DialogTitle>
            <DialogDescription>
              {createdCredentials 
                ? 'Share these credentials with the user. Password cannot be retrieved again!'
                : 'Create VIP account for this payment'
              }
            </DialogDescription>
          </DialogHeader>

          {createdCredentials ? (
            <div className="space-y-4">
              <div className="bg-success/10 border border-success/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="w-5 h-5 text-success" />
                  <span className="font-semibold text-success">Account Created!</span>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="bg-background px-3 py-2 rounded text-sm flex-1 font-mono">
                        {createdCredentials.email}
                      </code>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => copyToClipboard(createdCredentials.email, 'Email')}
                      >
                        {copiedField === 'Email' ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Password</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="bg-background px-3 py-2 rounded text-sm flex-1 font-mono">
                        {createdCredentials.password}
                      </code>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => copyToClipboard(createdCredentials.password, 'Password')}
                      >
                        {copiedField === 'Password' ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <Button 
                className="w-full" 
                onClick={() => {
                  setApprovingPayment(null);
                  setCreatedCredentials(null);
                }}
              >
                Done
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label htmlFor="approval-email">User Email</Label>
                <Input
                  id="approval-email"
                  type="email"
                  placeholder="Enter user's email"
                  value={approvalEmail}
                  onChange={(e) => setApprovalEmail(e.target.value)}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  A VIP account will be created with this email
                </p>
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setApprovingPayment(null)}
                >
                  Cancel
                </Button>
                <Button 
                  className="flex-1 bg-success hover:bg-success/90"
                  disabled={!approvalEmail || processingId === approvingPayment?.id}
                  onClick={handleApprove}
                >
                  {processingId === approvingPayment?.id ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  Create VIP Account
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;